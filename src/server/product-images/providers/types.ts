import type { ProductImageMatchMethod } from "../identity";

export type ProductImageProviderCandidate = {
  provider: string;
  sourcePageUrl: string;
  sourceImageUrl: string;
  sourceLicence: string;
  matchMethod: ProductImageMatchMethod;
  sourceIdentifierType: string | null;
  sourceIdentifierValue: string | null;
  sourceProductName: string | null;
  sourceBrand: string | null;
  sourceManufacturer: string | null;
  sourceMarket: string | null;
  sourcePackCount: string | null;
};

export type ProductImageProvider = {
  name: string;
  allowedImageHosts: readonly string[];
  findByGtin(gtin14: string): Promise<ProductImageProviderCandidate | null>;
};
