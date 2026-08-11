import assert from "node:assert/strict";
import test from "node:test";
import { splitImportedGenericName } from "./importedGenericName";

test("imported generic names split into clean individual database values", () => {
  assert.deepEqual(
    splitImportedGenericName("Dextromethorphan + Guaifenesin, Chlorpheniramine"),
    ["Dextromethorphan", "Guaifenesin", "Chlorpheniramine"],
  );
});

test("imported ingredient values never retain combination separators", () => {
  const names = splitImportedGenericName(
    "Glipizide+Metformin / Dapoxetine; Guaifenesin & Brompheniramine | Tramadol",
  );

  assert.deepEqual(names, [
    "Glipizide",
    "Metformin",
    "Dapoxetine",
    "Guaifenesin",
    "Brompheniramine",
    "Tramadol",
  ]);
  assert.ok(names.every((name) => !/[+,;/&|]/.test(name)));
});

test("word separators cannot make a combination look like monotherapy", () => {
  assert.deepEqual(splitImportedGenericName("Sildenafil and Dapoxetine"), [
    "Sildenafil",
    "Dapoxetine",
  ]);
  assert.deepEqual(splitImportedGenericName("Sildenafil และ Dapoxetine"), [
    "Sildenafil",
    "Dapoxetine",
  ]);
});
