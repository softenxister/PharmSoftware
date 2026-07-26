import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tailwindSource = readFileSync(
  new URL("./tailwind.css", import.meta.url),
  "utf8",
);

test("Tailwind scans every React source root", () => {
  for (const sourceRoot of ["app", "components", "features", "pages"]) {
    assert.match(
      tailwindSource,
      new RegExp(
        String.raw`@source ['"]\.\./${sourceRoot}/\*\*/\*\.\{js,ts,jsx,tsx\}['"];`,
      ),
      `Tailwind must scan src/${sourceRoot}`,
    );
  }
});
