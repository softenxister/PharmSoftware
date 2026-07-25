import type { ProductImageInspectionPolicy } from "../imageMetadata";
import type { ValidatedProductImage } from "../resolver";
import {
  fetchValidatedProductImage,
  ProductImageFetchHttpError,
} from "../secureFetch";
import {
  BRAVE_IMAGE_SEARCH_HOSTS,
  BRAVE_IMAGE_SEARCH_PROVIDER,
} from "./braveImageSearch";

export const BRAVE_IMAGE_INSPECTION_POLICY: ProductImageInspectionPolicy = {
  minimumShortSide: 96,
  minimumLongSide: 96,
};

export function candidateHasValidatedPreview(candidate: {
  provider: string;
  imageMimeType: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}): boolean {
  if (candidate.provider !== BRAVE_IMAGE_SEARCH_PROVIDER) return true;
  return Boolean(
    candidate.imageMimeType
    && candidate.imageWidth
    && candidate.imageWidth > 0
    && candidate.imageHeight
    && candidate.imageHeight > 0,
  );
}

function transientImageFailure(error: unknown): boolean {
  if (error instanceof ProductImageFetchHttpError) return error.status >= 500;
  return error instanceof TypeError
    || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name));
}

export async function fetchBraveCandidateImage(
  sourceImageUrl: string,
  options: {
    fetchImage?: (sourceImageUrl: string) => Promise<ValidatedProductImage>;
    sleep?: (milliseconds: number) => Promise<void>;
    maximumAttempts?: number;
  } = {},
): Promise<ValidatedProductImage> {
  const fetchImage = options.fetchImage ?? ((source) => fetchValidatedProductImage(source, {
    allowedHosts: BRAVE_IMAGE_SEARCH_HOSTS,
    inspectionPolicy: BRAVE_IMAGE_INSPECTION_POLICY,
  }));
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const maximumAttempts = Math.min(3, Math.max(1, Math.trunc(options.maximumAttempts ?? 3)));

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await fetchImage(sourceImageUrl);
    } catch (error) {
      if (attempt === maximumAttempts || !transientImageFailure(error)) throw error;
      await sleep(150 * attempt);
    }
  }
  throw new Error("The Brave candidate image could not be fetched.");
}
