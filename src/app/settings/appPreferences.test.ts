import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createAppPreferencesSavePayload,
  DEFAULT_APP_PREFERENCES,
  loadLocalAppPreferences,
  normalizeAppPreferences,
  parseAppPreferencesPatch,
  saveLocalAppPreferences,
} from "./appPreferences";

test("application preferences have conservative English pharmacy defaults", () => {
  assert.deepEqual(DEFAULT_APP_PREFERENCES, {
    locale: "en",
    colorTheme: "pharmacy-green",
    memberDefaultSort: "lastOrderAt",
    showArchivedMembers: false,
    analysisDefaultRange: "30d",
  });
});

test("preference updates accept known partial fields only", () => {
  assert.deepEqual(parseAppPreferencesPatch({ locale: "th" }), { locale: "th" });
  assert.deepEqual(parseAppPreferencesPatch({ colorTheme: "pink" }), { colorTheme: "pink" });
  assert.deepEqual(parseAppPreferencesPatch({ colorTheme: "orange" }), { colorTheme: "orange" });
  assert.deepEqual(parseAppPreferencesPatch({ colorTheme: "purple" }), { colorTheme: "purple" });
  assert.deepEqual(parseAppPreferencesPatch({
    locale: "en",
    memberDefaultSort: "name",
    showArchivedMembers: true,
    analysisDefaultRange: "7d",
  }), {
    locale: "en",
    memberDefaultSort: "name",
    showArchivedMembers: true,
    analysisDefaultRange: "7d",
  });

  assert.equal(parseAppPreferencesPatch({}), null);
  assert.equal(parseAppPreferencesPatch({ locale: "jp" }), null);
  assert.equal(parseAppPreferencesPatch({ colorTheme: "neon" }), null);
  assert.equal(parseAppPreferencesPatch({ locale: "th", role: "owner" }), null);
});

test("supported color themes survive preference normalization", () => {
  for (const colorTheme of ["pharmacy-green", "pink", "orange", "purple"] as const) {
    assert.equal(normalizeAppPreferences({ colorTheme }).colorTheme, colorTheme);
  }
});

test("changing language saves the selected color theme with the locale", () => {
  assert.deepEqual(
    createAppPreferencesSavePayload(
      { ...DEFAULT_APP_PREFERENCES, colorTheme: "pink" },
      { locale: "th" },
    ),
    { ...DEFAULT_APP_PREFERENCES, locale: "th", colorTheme: "pink" },
  );
});

test("the database accepts every selectable color theme", () => {
  const migration = readFileSync(
    new URL("../../../prisma/migrations/20260720120000_update_color_theme_constraint/migration.sql", import.meta.url),
    "utf8",
  );

  for (const colorTheme of ["pharmacy-green", "pink", "orange", "purple"]) {
    assert.match(migration, new RegExp(`'${colorTheme}'`));
  }
});

test("invalid stored preferences fall back field-by-field", () => {
  assert.deepEqual(normalizeAppPreferences({
    locale: "th",
    colorTheme: "neon",
    memberDefaultSort: null,
    showArchivedMembers: "yes",
    analysisDefaultRange: "90d",
  }), {
    ...DEFAULT_APP_PREFERENCES,
    locale: "th",
  });
});

test("a pending Thai selection remains stored for the same account after an API failure", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const thaiPreferences = { ...DEFAULT_APP_PREFERENCES, locale: "th" as const };

  saveLocalAppPreferences(storage, "pharmacist-1", thaiPreferences, true);

  assert.deepEqual(loadLocalAppPreferences(storage, "pharmacist-1"), {
    preferences: thaiPreferences,
    pendingSync: true,
  });
  assert.equal(loadLocalAppPreferences(storage, "owner-1"), null);
});

test("invalid local preference data is ignored safely", () => {
  const storage = {
    getItem: () => "not-json",
    setItem: (_key: string, _value: string) => undefined,
  };

  assert.equal(loadLocalAppPreferences(storage, "pharmacist-1"), null);
});
