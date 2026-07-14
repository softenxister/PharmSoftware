import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_MAX_AGE_SECONDS,
} from "./sessionToken";

const sharedAttributes = () => [
  "Path=/",
  "HttpOnly",
  "SameSite=Lax",
  ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
];

export function setSessionCookie(response: Response, token: string): void {
  response.headers.append("Set-Cookie", [
    `${AUTH_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    ...sharedAttributes(),
    `Max-Age=${AUTH_SESSION_MAX_AGE_SECONDS}`,
  ].join("; "));
}

export function clearSessionCookie(response: Response): void {
  response.headers.append("Set-Cookie", [
    `${AUTH_SESSION_COOKIE}=`,
    ...sharedAttributes(),
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; "));
}
