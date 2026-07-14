import assert from "node:assert/strict";
import test from "node:test";
import {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  getLoginThrottleStatus,
  hashLoginThrottleKey,
} from "./loginThrottle";

const now = new Date("2026-07-14T12:00:00.000Z");

test("login throttle allows a new username and hashes its identity", () => {
  assert.deepEqual(getLoginThrottleStatus(null, now), { blocked: false, retryAfterSeconds: 0 });
  assert.match(hashLoginThrottleKey("owner"), /^[a-f0-9]{64}$/);
  assert.equal(hashLoginThrottleKey("OWNER"), hashLoginThrottleKey(" owner "));
});

test("login throttle blocks the configured attempt limit within the window", () => {
  assert.deepEqual(getLoginThrottleStatus({
    attempts: LOGIN_MAX_ATTEMPTS,
    windowStartedAt: new Date(now.getTime() - 60_000),
  }, now), {
    blocked: true,
    retryAfterSeconds: Math.ceil((LOGIN_WINDOW_MS - 60_000) / 1000),
  });
});

test("login throttle resets after the window expires", () => {
  assert.deepEqual(getLoginThrottleStatus({
    attempts: LOGIN_MAX_ATTEMPTS,
    windowStartedAt: new Date(now.getTime() - LOGIN_WINDOW_MS - 1),
  }, now), { blocked: false, retryAfterSeconds: 0 });
});
