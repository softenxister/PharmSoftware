"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Camera, Check, ImagePlus, Save } from "lucide-react";
import type { PharmUser } from "@/server/auth/pharmUser";
import {
  EMPTY_STORE_PROFILE,
  MAX_STORE_PROFILE_IMAGE_BYTES,
  STORE_PROFILE_IMAGE_TYPES,
  type StoreProfile,
} from "./storeProfile";
import styles from "./Settings.module.css";
import profileStyles from "./StoreProfilePanel.module.css";

const editableFields: Array<{
  name: Exclude<keyof StoreProfile, "imageUrl">;
  label: string;
  type?: string;
  maxLength: number;
  required?: boolean;
  receiptRequired?: boolean;
}> = [
  { name: "storeName", label: "Store name", maxLength: 120, required: true },
  { name: "phone", label: "Store phone", type: "tel", maxLength: 40, receiptRequired: true },
  { name: "email", label: "Store email", type: "email", maxLength: 160 },
  { name: "taxId", label: "Tax ID", maxLength: 40, receiptRequired: true },
  { name: "pharmacyLicense", label: "Store pharmacy license", maxLength: 100 },
  { name: "lineId", label: "Store LINE ID", maxLength: 100 },
  { name: "facebookPage", label: "Facebook page", maxLength: 240 },
  { name: "openingTime", label: "Daily opening time", type: "time", maxLength: 5, receiptRequired: true },
  { name: "closingTime", label: "Daily closing time", type: "time", maxLength: 5, receiptRequired: true },
];

export function StoreProfilePanel({ user }: { user: PharmUser }) {
  const isOwner = user.role === "owner";
  const [profile, setProfile] = useState<StoreProfile>({ ...EMPTY_STORE_PROFILE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/store-profile", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { profile?: StoreProfile; error?: string };
        if (!response.ok || !body.profile) throw new Error(body.error || "Unable to load the store profile.");
        if (active) setProfile(body.profile);
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Unable to load the store profile."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const updateField = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));
    setMessage("");
  };

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOwner || !profile.storeName.trim()) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/store-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await response.json() as { profile?: StoreProfile; error?: string };
      if (!response.ok || !body.profile) throw new Error(body.error || "Unable to save the store profile.");
      setProfile(body.profile);
      setMessage("Store profile saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the store profile.");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setMessage("");
    setError("");
    if (!file) return;
    if (!STORE_PROFILE_IMAGE_TYPES.includes(file.type as typeof STORE_PROFILE_IMAGE_TYPES[number]) || file.size > MAX_STORE_PROFILE_IMAGE_BYTES) {
      setError("Choose a PNG, JPEG, or WebP image no larger than 1 MB.");
      input.value = "";
      return;
    }
    setUploading(true);
    try {
      const response = await fetch("/api/store-profile/image", {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const body = await response.json() as { profile?: StoreProfile; error?: string };
      if (!response.ok || !body.profile) throw new Error(body.error || "Unable to upload the store image.");
      setProfile(body.profile);
      setMessage("Store image uploaded");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload the store image.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="store-profile-title">
      <div className={styles.panelHeader}>
        <div><h2 id="store-profile-title" className={styles.panelTitle}>Store Profile</h2><p className={styles.panelDescription}>Pharmacy identity, contact channels, and receipt details.</p></div>
        {message && <span className={styles.savedBadge} role="status"><Check size={13} />{message}</span>}
      </div>

      <div className={profileStyles.body} aria-busy={loading}>
        <div className={profileStyles.imageEditor}>
          <div className={profileStyles.imagePreview}>
            {profile.imageUrl ? <img src={profile.imageUrl} alt="Current store profile" /> : <ImagePlus size={24} aria-hidden="true" />}
          </div>
          <div className={profileStyles.imageCopy}><strong>Store image</strong><small>Shown here in Settings only. PNG, JPEG, or WebP up to 1 MB.</small></div>
          {isOwner && <label className={`${styles.secondaryButton} ${profileStyles.imageButton}`}><Camera size={14} />{uploading ? "Uploading…" : "Choose image"}<input type="file" accept={STORE_PROFILE_IMAGE_TYPES.join(",")} onChange={uploadImage} disabled={uploading || loading} /></label>}
        </div>

        <form onSubmit={saveDetails}>
          <div className={profileStyles.grid}>
            {editableFields.map((field) => (
              <label className={styles.liveField} key={field.name}>
                <span>
                  {field.label}
                  {!field.required && <small>{field.receiptRequired ? " Required for receipts" : " Optional"}</small>}
                </span>
                <input name={field.name} type={field.type || "text"} value={profile[field.name]} onChange={updateField} maxLength={field.maxLength} required={field.required} readOnly={!isOwner} disabled={loading} />
              </label>
            ))}
            <label className={`${styles.liveField} ${profileStyles.addressField}`}>
              <span>Store address<small> Required for receipts</small></span>
              <textarea className={profileStyles.addressInput} name="address" value={profile.address} onChange={updateField} maxLength={500} readOnly={!isOwner} disabled={loading} rows={3} />
            </label>
          </div>
          {!isOwner && <p className={styles.readOnlyNote}>Store Profile is read-only for pharmacist accounts.</p>}
          {error && <div className={styles.formError} role="alert">{error}</div>}
          {isOwner && <div className={styles.formActions}><button className={styles.primaryButton} type="submit" disabled={loading || saving || uploading || !profile.storeName.trim()}><Save size={14} />{saving ? "Saving…" : "Save store profile"}</button></div>}
        </form>
      </div>
    </section>
  );
}
