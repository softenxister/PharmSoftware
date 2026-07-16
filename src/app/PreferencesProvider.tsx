import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/app/AuthProvider";
import {
  formatDate as formatLocalizedDate,
  formatMoney as formatLocalizedMoney,
  formatNumber as formatLocalizedNumber,
  translate,
  type TranslationKey,
  type TranslationParams,
} from "@/app/i18n/i18n";
import {
  DEFAULT_APP_PREFERENCES,
  loadLocalAppPreferences,
  normalizeAppPreferences,
  saveLocalAppPreferences,
  type AppPreferences,
  type AppPreferencesPatch,
} from "@/app/settings/appPreferences";

type PreferencesContextValue = {
  preferences: AppPreferences;
  isReady: boolean;
  isSaving: boolean;
  saveError: boolean;
  updatePreferences: (patch: AppPreferencesPatch) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatMoney: (value: number) => string;
};

type LoadedPreferences = {
  accountId: string | null;
  value: AppPreferences;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<LoadedPreferences>({
    accountId: null,
    value: { ...DEFAULT_APP_PREFERENCES },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const requestVersion = useRef(0);
  const activeAccountId = user?.id ?? null;
  const preferences = loaded.accountId === activeAccountId
    ? loaded.value
    : { ...DEFAULT_APP_PREFERENCES };

  useEffect(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setSaveError(false);
    setIsSaving(false);

    if (user === undefined) {
      setIsLoading(true);
      return;
    }
    if (user === null) {
      setLoaded({ accountId: null, value: { ...DEFAULT_APP_PREFERENCES } });
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const localPreferences = loadLocalAppPreferences(window.localStorage, user.id);
    setLoaded({
      accountId: user.id,
      value: localPreferences?.preferences ?? { ...DEFAULT_APP_PREFERENCES },
    });
    setIsLoading(true);
    void (async () => {
      try {
        const response = await fetch("/api/preferences", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json() as { preferences?: unknown };
        if (!response.ok || body.preferences === undefined) throw new Error("Preference load failed.");
        if (version !== requestVersion.current) return;
        const serverPreferences = normalizeAppPreferences(body.preferences);
        if (localPreferences?.pendingSync) {
          setLoaded({ accountId: user.id, value: localPreferences.preferences });
        } else {
          setLoaded({ accountId: user.id, value: serverPreferences });
          saveLocalAppPreferences(window.localStorage, user.id, serverPreferences, false);
        }
      } catch (error) {
        if (controller.signal.aborted || version !== requestVersion.current) return;
        setLoaded({
          accountId: user.id,
          value: localPreferences?.preferences ?? { ...DEFAULT_APP_PREFERENCES },
        });
      } finally {
        if (version === requestVersion.current) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = preferences.locale;
    root.dataset.locale = preferences.locale;
    root.dataset.theme = preferences.colorTheme;
  }, [preferences.colorTheme, preferences.locale]);

  const updatePreferences = useCallback(async (patch: AppPreferencesPatch) => {
    if (user === null) {
      setLoaded({ accountId: null, value: normalizeAppPreferences({ ...loaded.value, ...patch }) });
      setSaveError(false);
      return;
    }
    if (!user || loaded.accountId !== user.id || isSaving) return;
    const version = requestVersion.current;
    const previous = loaded.value;
    const optimistic = normalizeAppPreferences({ ...previous, ...patch });
    setLoaded({ accountId: user.id, value: optimistic });
    saveLocalAppPreferences(window.localStorage, user.id, optimistic, true);
    setIsSaving(true);
    setSaveError(false);

    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json() as { preferences?: unknown };
      if (!response.ok || body.preferences === undefined) throw new Error("Preference save failed.");
      if (version !== requestVersion.current) return;
      const savedPreferences = normalizeAppPreferences(body.preferences);
      setLoaded({ accountId: user.id, value: savedPreferences });
      saveLocalAppPreferences(window.localStorage, user.id, savedPreferences, false);
    } catch {
      if (version !== requestVersion.current) return;
      setLoaded({ accountId: user.id, value: optimistic });
      setSaveError(true);
    } finally {
      if (version === requestVersion.current) setIsSaving(false);
    }
  }, [isSaving, loaded, user]);

  const t = useCallback((key: TranslationKey, params?: TranslationParams) => (
    translate(preferences.locale, key, params)
  ), [preferences.locale]);
  const formatDate = useCallback((value: Date | string | number, options?: Intl.DateTimeFormatOptions) => (
    formatLocalizedDate(preferences.locale, value, options)
  ), [preferences.locale]);
  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => (
    formatLocalizedNumber(preferences.locale, value, options)
  ), [preferences.locale]);
  const formatMoney = useCallback((value: number) => (
    formatLocalizedMoney(preferences.locale, value)
  ), [preferences.locale]);

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    isReady: user !== undefined && !isLoading,
    isSaving,
    saveError,
    updatePreferences,
    t,
    formatDate,
    formatNumber,
    formatMoney,
  }), [formatDate, formatMoney, formatNumber, isLoading, isSaving, preferences, saveError, t, updatePreferences, user]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider.");
  return value;
}
