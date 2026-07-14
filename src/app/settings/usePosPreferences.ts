"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_POS_PREFERENCES,
  POS_PREFERENCES_CHANGED_EVENT,
  createPosPreferencesStorageKey,
  loadPosPreferences,
  savePosPreferences,
  type PosPreferenceAccount,
  type PosPreferences,
} from "./posPreferences";

export function usePosPreferences(account: PosPreferenceAccount) {
  const accountIdentity = useMemo(() => ({
    id: account.id,
    name: account.name,
    role: account.role,
  }), [account.id, account.name, account.role]);
  const storageKey = useMemo(
    () => createPosPreferencesStorageKey(accountIdentity),
    [accountIdentity],
  );
  const [preferences, setPreferences] = useState<PosPreferences>({ ...DEFAULT_POS_PREFERENCES });
  const preferencesRef = useRef<PosPreferences>({ ...DEFAULT_POS_PREFERENCES });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const reload = () => {
      const savedPreferences = loadPosPreferences(window.localStorage, accountIdentity);
      preferencesRef.current = savedPreferences;
      setPreferences(savedPreferences);
      setIsReady(true);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) reload();
    };
    const handlePreferenceChange = (event: Event) => {
      const changedKey = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey;
      if (!changedKey || changedKey === storageKey) reload();
    };

    reload();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(POS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(POS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
    };
  }, [accountIdentity, storageKey]);

  const updatePreferences = useCallback((next: PosPreferences | ((current: PosPreferences) => PosPreferences)) => {
    const resolved = typeof next === "function" ? next(preferencesRef.current) : next;
    preferencesRef.current = resolved;
    setPreferences(resolved);
    try {
      savePosPreferences(window.localStorage, accountIdentity, resolved);
      window.dispatchEvent(new CustomEvent(POS_PREFERENCES_CHANGED_EVENT, {
        detail: { storageKey },
      }));
    } catch {
      // Keep the in-memory preference usable when browser storage is unavailable.
    }
  }, [accountIdentity, storageKey]);

  return { preferences, updatePreferences, isReady };
}
