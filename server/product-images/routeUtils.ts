export function routeParameter(request: Request, marker: string, suffix = ""): string | null {
  const pathname = new URL(request.url).pathname;
  const start = pathname.indexOf(marker);
  if (start < 0) return null;
  const encoded = pathname.slice(start + marker.length, suffix ? -suffix.length : undefined);
  if (!encoded || (suffix && !pathname.endsWith(suffix))) return null;
  try {
    const value = decodeURIComponent(encoded);
    return value && value.length <= 200 ? value : null;
  } catch {
    return null;
  }
}
