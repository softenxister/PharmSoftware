import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPassword,
  verifyPassword,
} from "./password";
import {
  createSessionToken,
  hashSessionToken,
} from "./sessionToken";

test("password hashes use scrypt and verify without containing plaintext", async () => {
  const password = "temporary-safe-2026";
  const hash = await hashPassword(password);

  assert.match(hash, /^scrypt\$32768\$8\$1\$/);
  assert.equal(hash.includes(password), false);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("malformed password hashes fail closed", async () => {
  assert.equal(await verifyPassword("temporary-safe-2026", "not-a-password-hash"), false);
  assert.equal(await verifyPassword("temporary-safe-2026", "scrypt$32768$8$1$bad$bad"), false);
});

test("session token storage uses a one-way hash", () => {
  const token = createSessionToken();
  const storedHash = hashSessionToken(token);

  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(storedHash, /^[a-f0-9]{64}$/);
  assert.notEqual(storedHash, token);
  assert.equal(hashSessionToken(token), storedHash);
});
