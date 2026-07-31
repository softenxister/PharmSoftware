export function shouldDiscardStoredProductImage(input: {
  productIdentityChanged: boolean;
}): boolean {
  return input.productIdentityChanged;
}
