import type { SalesProduct } from "../types";
import { prisma } from "../core/prisma";
import type { PharmUser } from "@server/auth/pharmUser";
import {
  hasForbiddenStockDiscountChange,
  type StockItemDetailPatch,
} from "./stockItemDetail";
import { normalizeProductCategory } from "@server/import/productCategoryNormalization";
import { readStockProduct } from "./stockCatalogRepository";

export async function updateStockProductPhotoUrl(
  productId: string,
  photoUrl: string,
): Promise<{ productId: string; imageUrl: string } | null> {
  const updated = await prisma.product.updateMany({
    where: { id: productId, isActive: true },
    data: { imageUrl: photoUrl },
  });
  return updated.count === 1 ? { productId, imageUrl: photoUrl } : null;
}

export async function updateStockItemDetail(
  input: StockItemDetailPatch,
  user: Pick<PharmUser, "role">,
): Promise<SalesProduct | null> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id: input.productId } });
    if (!current || !current.isActive) return false;
    if (hasForbiddenStockDiscountChange(user.role, current, input)) {
      throw new Error("Stock discount permission denied.");
    }
    const categoryName = normalizeProductCategory({
      itemName: current.itemName,
      brandName: current.brandName,
      sourceCategory: input.category,
    });
    const category = await tx.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    await tx.product.update({
      where: { id: current.id },
      data: {
        location: input.location,
        categoryId: category.id,
        minimumStock: input.minimumStock,
        maximumStock: input.maximumStock,
        isReturnable: input.isReturnable,
        defaultDoseMorning: input.defaultDosage[0],
        defaultDoseNoon: input.defaultDosage[1],
        defaultDoseEvening: input.defaultDosage[2],
        defaultDoseNight: input.defaultDosage[3],
        tagName: input.tagName,
        ...(user.role === "owner" ? {
          discountPercent: input.discountPercent,
          isDiscountLocked: input.isDiscountLocked,
        } : {}),
      },
    });
    return true;
  });
  return updated ? readStockProduct(input.productId) : null;
}

export async function deleteStockItem(productId: string): Promise<string | null> {
  const result = await prisma.product.updateMany({
    where: { id: productId, isActive: true },
    data: { isActive: false },
  });
  return result.count === 0 ? null : productId;
}
