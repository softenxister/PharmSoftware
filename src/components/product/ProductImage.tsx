import type { ImgHTMLAttributes } from "react";

type ProductImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "decoding" | "fetchPriority" | "height" | "loading" | "src" | "width"
> & {
  alt: string;
  height: number;
  priority?: boolean;
  src: string;
  width: number;
};

export function ProductImage({
  alt,
  height,
  priority = false,
  src,
  width,
  ...imageProps
}: ProductImageProps) {
  return (
    <img
      {...imageProps}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
    />
  );
}
