import { useCallback, useEffect, useMemo, useState } from "react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { isAllowedMemberAvatarFile } from "@/lib/memberAvatar";
import {
  formatThaiPhoneNumberListInput,
  isValidThaiPhoneNumberList,
} from "@/lib/thaiPhoneNumber";
import type { MemberRecord } from "./memberData";
import {
  createMemberProfileDraft,
  serializeNewMemberProfileDraft,
  type MemberProfileDraft,
} from "./detail/memberProfileDraft";
import type { IngredientOption } from "./detail/memberProfileTypes";
import type { MemberProfileEditor } from "./detail/useMemberProfile";

const emptyMemberProfile = {
  name: "",
  mobile: "",
  avatarUrl: null,
  allergies: [],
};

export function useMemberCreate(onCreated: (member: MemberRecord) => void) {
  const { t } = usePreferences();
  const [draft, setDraft] = useState<MemberProfileDraft | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [ingredientOptionsOpen, setIngredientOptionsOpen] = useState(false);
  const [ingredientSearching, setIngredientSearching] = useState(false);
  const [ingredientSearchError, setIngredientSearchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const beginCreate = useCallback(() => {
    setDraft((current) => current ?? createMemberProfileDraft(emptyMemberProfile));
  }, []);

  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIngredientSearching(true);
      setIngredientSearchError("");
      try {
        const response = await fetch(
          `/api/ingredients?q=${encodeURIComponent(ingredientQuery.trim())}`,
          { cache: "no-store" },
        );
        const data = await response.json() as { ingredients?: IngredientOption[]; error?: string };
        if (!response.ok) throw new Error(data.error || t("member.allergySearchError"));
        if (!cancelled) {
          setIngredientOptions(Array.isArray(data.ingredients) ? data.ingredients : []);
        }
      } catch (error) {
        if (!cancelled) {
          setIngredientSearchError(
            error instanceof Error ? error.message : t("member.allergySearchError"),
          );
        }
      } finally {
        if (!cancelled) setIngredientSearching(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [draft, ingredientQuery, t]);

  const updateDraft = (update: (current: MemberProfileDraft) => MemberProfileDraft) => {
    setDraft((current) => current ? update(current) : current);
  };

  const cancel = () => {
    if (saving) return;
    setDraft(null);
    setAvatarError("");
    setIngredientQuery("");
    setIngredientOptions([]);
    setIngredientOptionsOpen(false);
    setIngredientSearchError("");
    setSaveError("");
  };

  const chooseAvatar = (file?: File) => {
    setAvatarError("");
    if (!file) return;
    if (!isAllowedMemberAvatarFile(file)) {
      setAvatarError(t("member.imageError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateDraft((current) => ({
          ...current,
          avatarUrl: reader.result as string,
          avatarChanged: true,
        }));
      }
    };
    reader.onerror = () => setAvatarError(t("member.imageError"));
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    updateDraft((current) => ({ ...current, avatarUrl: null, avatarChanged: true }));
    setAvatarError("");
  };

  const save = async () => {
    if (
      !draft
      || saving
      || !draft.name.trim()
      || !isValidThaiPhoneNumberList(draft.mobile)
    ) return;

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serializeNewMemberProfileDraft(draft)),
      });
      const data = await response.json() as { member?: MemberRecord; error?: string };
      if (!response.ok || !data.member) {
        throw new Error(data.error || t("member.createError"));
      }
      setDraft(null);
      onCreated(data.member);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("member.createError"));
    } finally {
      setSaving(false);
    }
  };

  const availableIngredientOptions = useMemo(() => {
    if (!draft) return [];
    return ingredientOptions.filter((ingredient) => (
      !draft.selectedAllergies.some(({ id }) => id === ingredient.id)
    ));
  }, [draft, ingredientOptions]);

  const editor: MemberProfileEditor | null = draft ? {
    draft,
    avatarError,
    ingredientQuery,
    ingredientOptions: availableIngredientOptions,
    ingredientOptionsOpen,
    ingredientSearching,
    ingredientSearchError,
    saving,
    saveError,
    mobileValid: isValidThaiPhoneNumberList(draft.mobile),
    canSave: !saving && Boolean(draft.name.trim()) && isValidThaiPhoneNumberList(draft.mobile),
    updateName: (name) => updateDraft((current) => ({ ...current, name })),
    updateMobile: (mobile) => updateDraft((current) => ({
      ...current,
      mobile: formatThaiPhoneNumberListInput(mobile),
    })),
    chooseAvatar,
    removeAvatar,
    addAllergy: (ingredient) => {
      updateDraft((current) => ({
        ...current,
        selectedAllergies: [...current.selectedAllergies, ingredient],
      }));
      setIngredientQuery("");
      setIngredientOptionsOpen(false);
    },
    removeAllergy: (ingredientId) => {
      updateDraft((current) => ({
        ...current,
        selectedAllergies: current.selectedAllergies.filter(({ id }) => id !== ingredientId),
      }));
    },
    setIngredientQuery: (query) => {
      setIngredientQuery(query);
      setIngredientOptionsOpen(true);
    },
    openIngredientOptions: () => setIngredientOptionsOpen(true),
    closeIngredientOptions: () => setIngredientOptionsOpen(false),
    cancel,
    save,
  } : null;

  return { beginCreate, cancel, editor };
}
