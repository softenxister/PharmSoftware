import { useEffect, useRef, type FormEvent } from "react";
import { Camera, Search, X } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { MemberAvatar } from "@/components/member/MemberAvatar";
import { shouldCloseDropdown } from "@/lib/dropdownInteraction";
import type { MemberProfileEditor } from "./useMemberProfile";
import styles from "./MemberDetail.module.css";

type MemberProfileDialogProps = {
  memberName: string;
  editor: MemberProfileEditor;
};

export function MemberProfileDialog({ memberName, editor }: MemberProfileDialogProps) {
  const { t } = usePreferences();
  const ingredientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor.ingredientOptionsOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (shouldCloseDropdown(ingredientDropdownRef.current, event.target as Node)) {
        editor.closeIngredientOptions();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [editor]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void editor.save();
  };

  return (
    <div
      className={styles.dialogBackdrop}
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") editor.cancel();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) editor.cancel();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-member-title"
      >
        <div className={styles.dialogHeader}>
          <div>
            <p>{t("member.profile")}</p>
            <h2 id="edit-member-title">{t("member.editProfile")}</h2>
          </div>
        </div>
        <form className={styles.editForm} onSubmit={submit}>
          <div className={styles.avatarEditor}>
            <MemberAvatar
              name={editor.draft.name || memberName}
              avatarUrl={editor.draft.avatarUrl}
              className={styles.avatarPreview}
            />
            <div className={styles.avatarCopy}>
              <strong>{t("member.profilePhoto")}</strong>
              <small id="member-photo-hint">{t("member.photoHint")}</small>
            </div>
            <label className={styles.photoButton}>
              <Camera size={14} aria-hidden="true" />
              {t("member.chooseImage")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-describedby="member-photo-hint"
                onChange={(event) => {
                  editor.chooseAvatar(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {editor.draft.avatarUrl && (
              <button
                type="button"
                className={styles.removePhotoButton}
                onClick={editor.removeAvatar}
              >
                {t("member.removePhoto")}
              </button>
            )}
            {editor.avatarError && (
              <p className={styles.avatarError} role="alert">{editor.avatarError}</p>
            )}
          </div>

          <label>
            <span>{t("member.customerName")}</span>
            <input
              value={editor.draft.name}
              onChange={(event) => editor.updateName(event.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </label>
          <label>
            <span>{t("member.mobile")}</span>
            <input
              value={editor.draft.mobile}
              onChange={(event) => editor.updateMobile(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              maxLength={200}
              placeholder="081-234-5678,089-123-4567"
              aria-describedby="edit-member-mobile-hint"
              aria-invalid={editor.draft.mobile.length > 0 && !editor.mobileValid}
              required
            />
          </label>
          <p id="edit-member-mobile-hint" className={styles.readOnlyNote}>
            {t("member.mobileHint")}
          </p>

          <div className={styles.allergyEditor}>
            <div className={styles.allergyEditorLabel}>
              <span>{t("member.drugAllergies")}</span>
              <small>{t("member.allergySelectHint")}</small>
            </div>
            {editor.draft.selectedAllergies.length > 0 && (
              <div
                className={styles.selectedAllergies}
                aria-label={t("member.selectedAllergies")}
              >
                {editor.draft.selectedAllergies.map((ingredient) => (
                  <span key={ingredient.id} className={styles.selectedAllergyTag}>
                    <span>{ingredient.canonicalName}</span>
                    <button
                      type="button"
                      onClick={() => editor.removeAllergy(ingredient.id)}
                      aria-label={t("member.removeAllergy", {
                        name: ingredient.canonicalName,
                      })}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div ref={ingredientDropdownRef}>
              <div className={styles.ingredientCombobox}>
                <Search size={15} aria-hidden="true" />
                <input
                  id="member-allergy-search"
                  type="search"
                  value={editor.ingredientQuery}
                  onChange={(event) => editor.setIngredientQuery(event.target.value)}
                  onFocus={editor.openIngredientOptions}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") editor.closeIngredientOptions();
                  }}
                  placeholder={t("member.searchIngredients")}
                  autoComplete="off"
                  role="combobox"
                  aria-haspopup="listbox"
                  aria-expanded={editor.ingredientOptionsOpen}
                  aria-controls="member-allergy-options"
                />
              </div>
              {editor.ingredientOptionsOpen && (
                <div
                  id="member-allergy-options"
                  className={styles.ingredientOptions}
                  role="listbox"
                  aria-label={t("member.ingredientResults")}
                >
                  {editor.ingredientSearching && (
                    <span className={styles.ingredientState}>{t("common.loading")}</span>
                  )}
                  {!editor.ingredientSearching && editor.ingredientSearchError && (
                    <span className={styles.ingredientState} role="alert">
                      {editor.ingredientSearchError}
                    </span>
                  )}
                  {!editor.ingredientSearching
                    && !editor.ingredientSearchError
                    && editor.ingredientOptions.map((ingredient) => (
                      <button
                        key={ingredient.id}
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => editor.addAllergy(ingredient)}
                      >
                        <strong>{ingredient.canonicalName}</strong>
                        <span>
                          {ingredient.thaiName
                            || ingredient.aliases?.slice(0, 2).join(" · ")
                            || t("member.standardIngredient")}
                        </span>
                      </button>
                    ))}
                  {!editor.ingredientSearching
                    && !editor.ingredientSearchError
                    && editor.ingredientOptions.length === 0 && (
                      <span className={styles.ingredientState}>{t("member.noIngredients")}</span>
                    )}
                </div>
              )}
            </div>
          </div>

          <p className={styles.readOnlyNote}>{t("member.loyaltyReadOnly")}</p>
          {editor.saveError && (
            <p className={styles.formError} role="alert">{editor.saveError}</p>
          )}
          <div className={styles.dialogActions}>
            <button type="button" onClick={editor.cancel}>{t("member.cancel")}</button>
            <button type="submit" disabled={!editor.canSave}>
              {editor.saving ? t("common.saving") : t("member.saveChanges")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
