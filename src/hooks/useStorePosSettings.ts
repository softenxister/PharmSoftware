import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_STORE_POS_SETTINGS,
  normalizeStorePosSettings,
  type StorePosSettings,
} from "@/config/preferences/storePosSettings";

const STORE_POS_SETTINGS_CHANGED_EVENT = "pharm:store-pos-settings-changed";

export function useStorePosSettings() {
  const [settings, setSettings] = useState<StorePosSettings>({
    ...DEFAULT_STORE_POS_SETTINGS,
    paymentMethods: [...DEFAULT_STORE_POS_SETTINGS.paymentMethods],
  });
  const settingsRef = useRef(settings);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/store-pos-settings", { cache: "no-store" });
      const body = await response.json() as { settings?: unknown; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load store POS settings.");
      const next = normalizeStorePosSettings(body.settings);
      settingsRef.current = next;
      setSettings(next);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load store POS settings.");
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    const handleChanged = () => { void reload(); };
    const handleFocus = () => { void reload(); };
    void reload();
    window.addEventListener(STORE_POS_SETTINGS_CHANGED_EVENT, handleChanged);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener(STORE_POS_SETTINGS_CHANGED_EVENT, handleChanged);
      window.removeEventListener("focus", handleFocus);
    };
  }, [reload]);

  const updateStoreSettings = useCallback(async (next: StorePosSettings) => {
    if (isSavingRef.current) return false;
    const previous = settingsRef.current;
    settingsRef.current = next;
    setSettings(next);
    isSavingRef.current = true;
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/store-pos-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await response.json() as { settings?: unknown; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save store POS settings.");
      const saved = normalizeStorePosSettings(body.settings);
      settingsRef.current = saved;
      setSettings(saved);
      window.dispatchEvent(new Event(STORE_POS_SETTINGS_CHANGED_EVENT));
      return true;
    } catch (nextError) {
      settingsRef.current = previous;
      setSettings(previous);
      setError(nextError instanceof Error ? nextError.message : "Unable to save store POS settings.");
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, []);

  return { settings, isReady, isSaving, error, updateStoreSettings };
}
