import { promises as fs } from "node:fs";
import path from "node:path";
import { Prisma } from "@server/generated/prisma/client";
import { prisma } from "@server/db/core/prisma";
import {
  extractThaiPharmacyBrand,
  resolveImportedBrandName,
} from "@server/import/thaiBrandExtractor";

const shouldApply = process.argv.includes("--apply");
const requestedBrandName = process.argv
  .find((argument) => argument.startsWith("--brand="))
  ?.slice("--brand=".length)
  .trim();
const requestedConfidence = process.argv
  .find((argument) => argument.startsWith("--confidence="))
  ?.slice("--confidence=".length)
  .trim();
const onlyUnspecified = process.argv.includes("--only-unspecified");

if (process.argv.some((argument) => argument.startsWith("--brand=")) && !requestedBrandName) {
  throw new Error("--brand requires a non-empty brand name.");
}
if (requestedConfidence && !["high", "medium", "review"].includes(requestedConfidence)) {
  throw new Error("--confidence must be high, medium, or review.");
}

const products = await prisma.product.findMany({
  where: { externalProductCode: { not: null } },
  orderBy: { externalProductCode: "asc" },
  select: {
    id: true,
    externalProductCode: true,
    itemName: true,
    brandName: true,
  },
});

const changes = products.map((product) => {
  const extraction = extractThaiPharmacyBrand(product.itemName);
  const nextBrandName = resolveImportedBrandName({
    extractedBrandName: extraction.brandName,
    existingBrandName: product.brandName,
    existingItemName: product.itemName,
  });
  return {
    id: product.id,
    externalProductCode: product.externalProductCode,
    itemName: product.itemName,
    previousBrandName: product.brandName,
    ...extraction,
    nextBrandName,
  };
})
  .filter((product) => product.previousBrandName !== product.nextBrandName)
  .filter((product) => !requestedBrandName || product.nextBrandName === requestedBrandName)
  .filter((product) => !requestedConfidence || product.confidence === requestedConfidence)
  .filter((product) => !onlyUnspecified || product.previousBrandName === "Unspecified");

const summary = {
  scannedCount: products.length,
  changedCount: changes.length,
  highConfidenceCount: changes.filter((change) => change.confidence === "high").length,
  mediumConfidenceCount: changes.filter((change) => change.confidence === "medium").length,
  reviewCount: changes.filter((change) => change.confidence === "review").length,
};

if (!shouldApply) {
  console.log(JSON.stringify({
    mode: "preview",
    requestedBrandName: requestedBrandName ?? null,
    requestedConfidence: requestedConfidence ?? null,
    onlyUnspecified,
    summary,
    changes: changes.map((change) => ({
      externalProductCode: change.externalProductCode,
      itemName: change.itemName,
      previousBrandName: change.previousBrandName,
      nextBrandName: change.nextBrandName,
      confidence: change.confidence,
      matchedAlias: change.matchedAlias,
    })),
  }, null, 2));
  await prisma.$disconnect();
} else {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDirectory = path.resolve("data/outputs/cw-brand-normalization-backups");
  const backupPath = path.join(backupDirectory, `${timestamp}.json`);
  await fs.mkdir(backupDirectory, { recursive: true });
  await fs.writeFile(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), summary, products }, null, 2)}\n`);

  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.product.update({
        where: { id: change.id },
        data: { brandName: change.nextBrandName },
      });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 120_000,
  });

  console.log(JSON.stringify({
    mode: "applied",
    requestedBrandName: requestedBrandName ?? null,
    requestedConfidence: requestedConfidence ?? null,
    onlyUnspecified,
    summary,
    backupPath,
  }, null, 2));
  await prisma.$disconnect();
}
