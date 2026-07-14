import { AsyncLocalStorage } from "node:async_hooks";

const requestStorage = new AsyncLocalStorage<Request>();

export function runWithRequest<T>(request: Request, operation: () => T): T {
  return requestStorage.run(request, operation);
}

export function getCurrentRequest(): Request | undefined {
  return requestStorage.getStore();
}

export function getRequestCookie(name: string): string | undefined {
  const cookieHeader = getCurrentRequest()?.headers.get("cookie");
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    const rawValue = cookie.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
