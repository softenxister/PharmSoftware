export type StockImageUpdateDecision = {
  discardImageRecords: boolean;
  resetImageResolution: boolean;
};

export function stockImageUpdateDecision(input: {
  productIdentityChanged: boolean;
  imageUrlChanged: boolean;
}): StockImageUpdateDecision {
  return {
    discardImageRecords: input.productIdentityChanged,
    resetImageResolution: input.productIdentityChanged || input.imageUrlChanged,
  };
}
