import { useEffect, useMemo, useState } from "react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { isAllowedMemberAvatarFile } from "@/lib/memberAvatar";
import {
  formatThaiPhoneNumberListInput,
  isValidThaiPhoneNumberList,
} from "@/lib/thaiPhoneNumber";
import type { MemberRecord } from "../memberData";
import {
  createMemberProfileDraft,
  isMemberProfileDraftUnchanged,
  serializeMemberProfileDraft,
  type MemberProfileDraft,
} from "./memberProfileDraft";
import type { IngredientOption, MemberDetailRecord } from "./memberProfileTypes";

export function useMemberProfile(memberId: string) {
  const { t } = usePreferences();
  const [member, setMember] = useState<MemberDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MemberProfileDraft | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [ingredientOptionsOpen, setIngredientOptionsOpen] = useState(false);
  const [ingredientSearching, setIngredientSearching] = useState(false);
  const [ingredientSearchError, setIngredientSearchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMember() {
      setLoading(true);
      setLoadError("");
      setNotFound(false);
      try {
        const response = await fetch(
          `/api/members?memberId=${encodeURIComponent(memberId)}`,
          { cache: "no-store" },
        );
        const data = await response.json() as { member?: MemberDetailRecord; error?: string };
        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!response.ok || !data.member) {
          throw new Error(data.error || t("member.loadError"));
        }
        if (!cancelled) setMember(data.member);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : t("member.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMember();
    return () => {
      cancelled = true;
    };
  }, [memberId, t]);

  useEffect(() => {
    if (!editing) return;
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
  }, [editing, ingredientQuery, t]);

  const beginEdit = () => {
    if (!member) return;
    setDraft(createMemberProfileDraft(member));
    setAvatarError("");
    setIngredientQuery("");
    setIngredientOptions([]);
    setIngredientOptionsOpen(false);
    setIngredientSearchError("");
    setSaveError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setDraft(null);
    setAvatarError("");
    setSaveError("");
  };

  const updateDraft = (update: (current: MemberProfileDraft) => MemberProfileDraft) => {
    setDraft((current) => current ? update(current) : current);
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

  const addAllergy = (ingredient: IngredientOption) => {
    updateDraft((current) => ({
      ...current,
      selectedAllergies: [...current.selectedAllergies, ingredient],
    }));
    setIngredientQuery("");
    setIngredientOptionsOpen(false);
  };

  const removeAllergy = (ingredientId: string) => {
    updateDraft((current) => ({
      ...current,
      selectedAllergies: current.selectedAllergies.filter(({ id }) => id !== ingredientId),
    }));
  };

  const saveProfile = async () => {
    if (
      !member
      || !draft
      || saving
      || !draft.name.trim()
      || !isValidThaiPhoneNumberList(draft.mobile)
    ) return;

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serializeMemberProfileDraft(member.id, draft)),
      });
      const data = await response.json() as { member?: MemberRecord; error?: string };
      if (!response.ok || !data.member) {
        throw new Error(data.error || t("member.updateError"));
      }
      setMember((current) => current ? { ...current, ...data.member } : current);
      setEditing(false);
      setDraft(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("member.updateError"));
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

  const mobileValid = draft ? isValidThaiPhoneNumberList(draft.mobile) : false;
  const unchanged = draft && member ? isMemberProfileDraftUnchanged(draft, member) : true;
  const editor = editing && draft ? {
    draft,
    avatarError,
    ingredientQuery,
    ingredientOptions: availableIngredientOptions,
    ingredientOptionsOpen,
    ingredientSearching,
    ingredientSearchError,
    saving,
    saveError,
    mobileValid,
    canSave: !saving && Boolean(draft.name.trim()) && mobileValid && !unchanged,
    updateName: (name: string) => updateDraft((current) => ({ ...current, name })),
    updateMobile: (mobile: string) => updateDraft((current) => ({
      ...current,
      mobile: formatThaiPhoneNumberListInput(mobile),
    })),
    chooseAvatar,
    removeAvatar,
    addAllergy,
    removeAllergy,
    setIngredientQuery: (query: string) => {
      setIngredientQuery(query);
      setIngredientOptionsOpen(true);
    },
    openIngredientOptions: () => setIngredientOptionsOpen(true),
    closeIngredientOptions: () => setIngredientOptionsOpen(false),
    cancel: cancelEdit,
    save: saveProfile,
  } : null;

  return {
    member,
    loading,
    loadError,
    notFound,
    beginEdit,
    editor,
  };
}

export type MemberProfileEditor = NonNullable<ReturnType<typeof useMemberProfile>["editor"]>;
