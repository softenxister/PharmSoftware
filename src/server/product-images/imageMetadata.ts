export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;

export type ProductImageMetadata = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  width: number;
  height: number;
  byteSize: number;
};

export type ProductImageInspectionPolicy = {
  minimumShortSide: number;
  minimumLongSide: number;
};

const DEFAULT_INSPECTION_POLICY: ProductImageInspectionPolicy = {
  minimumShortSide: 600,
  minimumLongSide: 800,
};

function uint24Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function pngDimensions(bytes: Uint8Array): [number, number] | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function jpegDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) break;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 30
    || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF"
    || String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") return [uint24Le(bytes, 24) + 1, uint24Le(bytes, 27) + 1];
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return [
      (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    ];
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return null;
}

function avifDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 24 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return null;
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  if (!["avif", "avis"].includes(brand)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 20 <= bytes.length; offset += 1) {
    if (String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) === "ispe") {
      return [view.getUint32(offset + 12), view.getUint32(offset + 16)];
    }
  }
  return null;
}

export function inspectProductImage(
  bytes: Uint8Array,
  _declaredContentType?: string | null,
  policy: ProductImageInspectionPolicy = DEFAULT_INSPECTION_POLICY,
): ProductImageMetadata {
  if (bytes.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error("Product images must not exceed 8 MiB.");
  }

  const detected = [
    ["image/png", pngDimensions(bytes)],
    ["image/jpeg", jpegDimensions(bytes)],
    ["image/webp", webpDimensions(bytes)],
    ["image/avif", avifDimensions(bytes)],
  ].find((entry) => entry[1] !== null) as [ProductImageMetadata["mimeType"], [number, number]] | undefined;
  if (!detected) throw new Error("Unsupported or invalid product image format.");

  const [mimeType, [width, height]] = detected;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Invalid product image dimensions.");
  }
  if (
    Math.min(width, height) < policy.minimumShortSide
    && Math.max(width, height) < policy.minimumLongSide
  ) {
    throw new Error("Product image resolution is too small.");
  }
  const aspectRatio = width / height;
  if (aspectRatio < 0.2 || aspectRatio > 5) throw new Error("Product image aspect ratio is not useful.");

  return { mimeType, width, height, byteSize: bytes.byteLength };
}
