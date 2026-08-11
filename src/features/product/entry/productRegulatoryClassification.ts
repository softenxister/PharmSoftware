import type {
  ImportedProductIngredient,
  ProductCompositionStatus,
  ProductIngredient,
} from "@server/db/types";
import { classifyStockRegulatoryForms } from "@/lib/stockRegulatoryRecords";
import { splitImportedGenericName } from "./productComposition";

type ProductRegulatoryClassificationInput = {
  variant: "default" | "edit-row";
  legalCategory?: string;
  compositionStatus?: ProductCompositionStatus;
  activeIngredients?: readonly ProductIngredient[];
  importedIngredients?: readonly ImportedProductIngredient[];
  genericName?: string;
};

export function classifyProductRegulatoryForms({
  variant,
  legalCategory,
  compositionStatus,
  activeIngredients,
  importedIngredients,
  genericName,
}: ProductRegulatoryClassificationInput) {
  return classifyStockRegulatoryForms({
    legalCategory,
    compositionStatus,
    activeIngredients,
    importedIngredients: variant === "edit-row"
      ? importedIngredients?.length
        ? importedIngredients
        : splitImportedGenericName(genericName ?? "").map((canonicalName) => ({ canonicalName }))
      : [],
  });
}
