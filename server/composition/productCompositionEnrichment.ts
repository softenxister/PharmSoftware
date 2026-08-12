import {
  ProductCompositionStatus,
  ProductDosageFormSource,
} from "@server/generated/prisma/client";
import { prisma } from "@server/db/core/prisma";
import { canonicalIngredient } from "./ingredientNormalization";
import { lookupOpenFdaComposition } from "./openFdaCompositionProvider";
import { lookupThaiFdaComposition } from "./thaiFdaCompositionProvider";
import { inferProductDosageForm } from "@/lib/productDosageForm";

const RETRY_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10;

async function enrichProduct(product: {
  id: string;
  barcode: string;
  itemName: string;
  brandName: string;
  childUnit: string;
  dosageFormSource: ProductDosageFormSource;
  manufacturer: { name: string };
}) {
  try {
    const lookup = {
      barcode: product.barcode,
      itemName: product.itemName,
      brandName: product.brandName,
      manufacturerName: product.manufacturer.name,
    };
    let result = null;
    try {
      result = await lookupThaiFdaComposition(lookup);
    } catch {
      // The Thai FDA site is an HTML service rather than a stable API. A temporary
      // outage or markup change must not prevent the official international fallback.
    }
    result ??= await lookupOpenFdaComposition(lookup);
    if (!result) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          compositionStatus: ProductCompositionStatus.UNAVAILABLE,
          compositionCheckedAt: new Date(),
          compositionRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
          compositionError: "No unambiguous authoritative composition match was found.",
        },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.productIngredient.deleteMany({ where: { productId: product.id } });
      for (const sourceIngredient of result.ingredients) {
        const ingredient = canonicalIngredient(sourceIngredient.name);
        const savedIngredient = await tx.ingredient.upsert({
          where: { normalizedName: ingredient.normalizedName },
          update: {
            canonicalName: ingredient.canonicalName,
            aliases: ingredient.aliases,
          },
          create: ingredient,
        });
        await tx.productIngredient.create({
          data: {
            productId: product.id,
            ingredientId: savedIngredient.id,
            strength: sourceIngredient.strength,
            sourceName: result.sourceName,
            sourceRecordId: result.sourceRecordId,
            sourceUrl: result.sourceUrl,
          },
        });
      }
      const officialDosageForm = result.dosageForm
        ? inferProductDosageForm({
            itemName: product.itemName,
            category: "",
            childUnit: product.childUnit,
            thaiFdaDosageForm: result.dosageForm,
          }).dosageForm
        : null;
      await tx.product.update({
        where: { id: product.id },
        data: {
          compositionStatus: ProductCompositionStatus.VERIFIED,
          compositionCheckedAt: new Date(),
          compositionRetryAt: null,
          compositionError: null,
          ...(product.dosageFormSource !== ProductDosageFormSource.MANUAL
            && officialDosageForm
            && officialDosageForm !== "Unclassified"
            && officialDosageForm !== "Not Applicable"
            ? {
                dosageForm: officialDosageForm,
                dosageFormSource: ProductDosageFormSource.THAI_FDA,
              }
            : {}),
        },
      });
    });
  } catch {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        compositionStatus: ProductCompositionStatus.UNAVAILABLE,
        compositionCheckedAt: new Date(),
        compositionRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
        compositionError: "The authoritative composition service was unavailable.",
      },
    });
  }
}

async function enrichPendingProductCompositions(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { compositionStatus: ProductCompositionStatus.PENDING },
        {
          compositionStatus: ProductCompositionStatus.UNAVAILABLE,
          compositionRetryAt: { lte: now },
        },
      ],
    },
    include: { manufacturer: { select: { name: true } } },
    orderBy: { updatedAt: "asc" },
    take: Math.min(50, Math.max(1, Math.trunc(batchSize))),
  });
  for (const product of products) await enrichProduct(product);
  return products.length;
}

export function startProductCompositionWorker() {
  let running = false;
  let stopped = false;
  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await enrichPendingProductCompositions();
    } catch (error) {
      console.error("Product composition enrichment failed", error);
    } finally {
      running = false;
    }
  };

  const initial = setTimeout(() => void run(), 2_500);
  const interval = setInterval(() => void run(), 15 * 60 * 1000);
  initial.unref?.();
  interval.unref?.();
  return () => {
    stopped = true;
    clearTimeout(initial);
    clearInterval(interval);
  };
}
