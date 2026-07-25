export function openProductsFactsImageResolutionIsEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.OPEN_PRODUCTS_FACTS_IMAGE_RESOLUTION_ENABLED === "true";
}
