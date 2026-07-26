import assert from "node:assert/strict";
import test from "node:test";
import {
  getRequestCookie,
  runWithRequest,
} from "./requestContext";
import {
  clearSessionCookie,
  setSessionCookie,
} from "./sessionCookie";
import { AUTH_SESSION_COOKIE } from "./sessionToken";

test("request context reads an encoded cookie without leaking adjacent values", async () => {
  const request = new Request("http://pharm.test/api/current-user", {
    headers: { cookie: `other=one; ${AUTH_SESSION_COOKIE}=token%2Evalue; suffix=two` },
  });

  await runWithRequest(request, async () => {
    assert.equal(getRequestCookie(AUTH_SESSION_COOKIE), "token.value");
    assert.equal(getRequestCookie("missing"), undefined);
  });
  assert.equal(getRequestCookie(AUTH_SESSION_COOKIE), undefined);
});

test("session cookies retain secure HttpOnly browser attributes", () => {
  const response = Response.json({ ok: true });
  setSessionCookie(response, "session-token");
  const cookie = response.headers.get("set-cookie") || "";

  assert.match(cookie, new RegExp(`^${AUTH_SESSION_COOKIE}=session-token;`));
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=\d+/);
});

test("production session cookies require a secure transport", () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const response = Response.json({ ok: true });
    setSessionCookie(response, "session-token");
    assert.match(response.headers.get("set-cookie") || "", /; Secure(?:;|$)/);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test("clearing a session expires the same cookie immediately", () => {
  const response = Response.json({ ok: true });
  clearSessionCookie(response);
  const cookie = response.headers.get("set-cookie") || "";

  assert.match(cookie, new RegExp(`^${AUTH_SESSION_COOKIE}=;`));
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(cookie, /HttpOnly/);
});
