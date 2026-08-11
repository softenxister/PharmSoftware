export function splitImportedGenericName(genericName: string): string[] {
  return genericName
    .split(/[+,;/&|]|\s+(?:and|และ)\s+/iu)
    .map((name) => name.trim())
    .filter(Boolean);
}
