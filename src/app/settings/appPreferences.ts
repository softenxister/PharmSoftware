export type AppLocale = "en" | "th";
export type ColorTheme = "pharmacy-green" | "pink" | "orange" | "purple";
export type MemberDefaultSort = "lastOrderAt" | "name" | "registeredAt";
export type AnalysisDefaultRange = "today" | "7d" | "30d";

export type AppPreferences = {
  locale: AppLocale;
  colorTheme: ColorTheme;
  memberDefaultSort: MemberDefaultSort;
  showArchivedMembers: boolean;
  analysisDefaultRange: AnalysisDefaultRange;
};

export type AppPreferencesPatch = Partial<AppPreferences>;

export type LocalAppPreferences = {
  preferences: AppPreferences;
  pendingSync: boolean;
};

type AppPreferencesStorage = Pick<Storage, "getItem" | "setItem">;

export const DEFAULT_APP_PREFERENCES: Readonly<AppPreferences> = Object.freeze({
  locale: "en",
  colorTheme: "pharmacy-green",
  memberDefaultSort: "lastOrderAt",
  showArchivedMembers: false,
  analysisDefaultRange: "30d",
});

const APP_PREFERENCE_KEYS = new Set<keyof AppPreferences>([
  "locale",
  "colorTheme",
  "memberDefaultSort",
  "showArchivedMembers",
  "analysisDefaultRange",
]);

const APP_PREFERENCES_STORAGE_PREFIX = "pharm:app-preferences:";

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === "object" && !Array.isArray(value)
);

const isLocale = (value: unknown): value is AppLocale => value === "en" || value === "th";
const isColorTheme = (value: unknown): value is ColorTheme => (
  value === "pharmacy-green" || value === "pink" || value === "orange" || value === "purple"
);
const isMemberDefaultSort = (value: unknown): value is MemberDefaultSort => (
  value === "lastOrderAt" || value === "name" || value === "registeredAt"
);
const isAnalysisDefaultRange = (value: unknown): value is AnalysisDefaultRange => (
  value === "today" || value === "7d" || value === "30d"
);

export function normalizeAppPreferences(value: unknown): AppPreferences {
  const input = isRecord(value) ? value : {};
  return {
    locale: isLocale(input.locale) ? input.locale : DEFAULT_APP_PREFERENCES.locale,
    colorTheme: isColorTheme(input.colorTheme) ? input.colorTheme : DEFAULT_APP_PREFERENCES.colorTheme,
    memberDefaultSort: isMemberDefaultSort(input.memberDefaultSort)
      ? input.memberDefaultSort
      : DEFAULT_APP_PREFERENCES.memberDefaultSort,
    showArchivedMembers: typeof input.showArchivedMembers === "boolean"
      ? input.showArchivedMembers
      : DEFAULT_APP_PREFERENCES.showArchivedMembers,
    analysisDefaultRange: isAnalysisDefaultRange(input.analysisDefaultRange)
      ? input.analysisDefaultRange
      : DEFAULT_APP_PREFERENCES.analysisDefaultRange,
  };
}

export function createAppPreferencesSavePayload(
  current: AppPreferences,
  patch: AppPreferencesPatch,
): AppPreferences {
  return normalizeAppPreferences({ ...current, ...patch });
}

export function parseAppPreferencesPatch(value: unknown): AppPreferencesPatch | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !APP_PREFERENCE_KEYS.has(key as keyof AppPreferences))) return null;

  const patch: AppPreferencesPatch = {};
  if ("locale" in value) {
    if (!isLocale(value.locale)) return null;
    patch.locale = value.locale;
  }
  if ("colorTheme" in value) {
    if (!isColorTheme(value.colorTheme)) return null;
    patch.colorTheme = value.colorTheme;
  }
  if ("memberDefaultSort" in value) {
    if (!isMemberDefaultSort(value.memberDefaultSort)) return null;
    patch.memberDefaultSort = value.memberDefaultSort;
  }
  if ("showArchivedMembers" in value) {
    if (typeof value.showArchivedMembers !== "boolean") return null;
    patch.showArchivedMembers = value.showArchivedMembers;
  }
  if ("analysisDefaultRange" in value) {
    if (!isAnalysisDefaultRange(value.analysisDefaultRange)) return null;
    patch.analysisDefaultRange = value.analysisDefaultRange;
  }
  return patch;
}

function appPreferencesStorageKey(accountId: string): string {
  return `${APP_PREFERENCES_STORAGE_PREFIX}${encodeURIComponent(accountId)}`;
}

export function loadLocalAppPreferences(
  storage: Pick<AppPreferencesStorage, "getItem">,
  accountId: string,
): LocalAppPreferences | null {
  if (!accountId) return null;

  try {
    const raw = storage.getItem(appPreferencesStorageKey(accountId));
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    if (
      !isRecord(stored)
      || !isRecord(stored.preferences)
      || typeof stored.pendingSync !== "boolean"
    ) return null;

    return {
      preferences: normalizeAppPreferences(stored.preferences),
      pendingSync: stored.pendingSync,
    };
  } catch {
    return null;
  }
}

export function saveLocalAppPreferences(
  storage: Pick<AppPreferencesStorage, "setItem">,
  accountId: string,
  preferences: AppPreferences,
  pendingSync: boolean,
): boolean {
  if (!accountId) return false;

  try {
    storage.setItem(appPreferencesStorageKey(accountId), JSON.stringify({
      preferences: normalizeAppPreferences(preferences),
      pendingSync,
    } satisfies LocalAppPreferences));
    return true;
  } catch {
    return false;
  }
}
