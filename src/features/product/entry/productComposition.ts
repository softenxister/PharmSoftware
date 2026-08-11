import { splitImportedGenericName } from "@/lib/importedGenericName";

export { splitImportedGenericName } from "@/lib/importedGenericName";

export function shouldShowImportedGenericName(genericName: string | undefined): boolean {
  return splitImportedGenericName(genericName ?? "").length === 1;
}

export type ProductCompositionRow = {
  id: string;
  canonicalName: string;
  thaiName?: string;
  strength?: string;
};

export function getProductCompositionRows(
  activeIngredients: readonly ProductCompositionRow[] | undefined,
  genericName: string | undefined,
  importedIngredients?: readonly ProductCompositionRow[],
): readonly ProductCompositionRow[] {
  if (activeIngredients?.length) return activeIngredients;
  if (importedIngredients?.length) return importedIngredients;

  const importedNames = splitImportedGenericName(genericName ?? "");
  if (importedNames.length < 2) return [];

  return importedNames.map((canonicalName, index) => ({
    id: `imported-generic-${index + 1}`,
    canonicalName,
  }));
}
