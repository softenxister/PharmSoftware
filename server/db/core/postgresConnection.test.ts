import assert from "node:assert/strict";
import test from "node:test";
import { normalizePostgresConnectionString } from "./postgresConnection";

test("legacy pg SSL modes keep their current certificate-verifying behavior explicitly", () => {
  assert.equal(
    normalizePostgresConnectionString("postgresql://host/db?sslmode=require&pool=true"),
    "postgresql://host/db?sslmode=verify-full&pool=true",
  );
  assert.equal(
    normalizePostgresConnectionString("postgresql://host/db?pool=true&sslmode=verify-ca"),
    "postgresql://host/db?pool=true&sslmode=verify-full",
  );
});

test("explicit libpq compatibility and unrelated connection strings remain unchanged", () => {
  const compatible = "postgresql://host/db?uselibpqcompat=true&sslmode=require";
  assert.equal(normalizePostgresConnectionString(compatible), compatible);
  assert.equal(
    normalizePostgresConnectionString("postgresql://host/db?sslmode=verify-full"),
    "postgresql://host/db?sslmode=verify-full",
  );
});
