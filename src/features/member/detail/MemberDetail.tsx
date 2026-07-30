import { ArrowLeft, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { MemberAllergyPanel } from "./MemberAllergyPanel";
import { MemberProfileDialog } from "./MemberProfileDialog";
import { MemberPurchaseHistory } from "./MemberPurchaseHistory";
import { MemberSummary } from "./MemberSummary";
import { useMemberProfile } from "./useMemberProfile";
import styles from "./MemberDetail.module.css";

export function MemberDetail() {
  const { memberId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = usePreferences();
  const profile = useMemberProfile(memberId);
  const backToMembers = () => navigate("/member");

  if (profile.loading) {
    return <div className={styles.statePage} role="status">{t("common.loading")}</div>;
  }

  if (profile.notFound) {
    return (
      <div className={styles.statePage} role="alert">
        <UserRound size={32} aria-hidden="true" />
        <strong>{t("member.notFound")}</strong>
        <span>{t("member.notFoundHint")}</span>
        <button type="button" onClick={backToMembers}>{t("member.backToList")}</button>
      </div>
    );
  }

  if (profile.loadError || !profile.member) {
    return (
      <div className={styles.statePage} role="alert">
        <strong>{t("member.loadError")}</strong>
        <span>{profile.loadError}</span>
        <button type="button" onClick={backToMembers}>{t("member.backToList")}</button>
      </div>
    );
  }

  const { member } = profile;
  const visibleAvatarUrl = profile.editor?.draft.avatarUrl ?? member.avatarUrl;

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <button type="button" className={styles.backButton} onClick={backToMembers}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t("member.backToList")}
        </button>
        <MemberSummary
          member={member}
          avatarUrl={visibleAvatarUrl}
          onEdit={profile.beginEdit}
        />
        <MemberAllergyPanel allergies={member.allergies} />
        <MemberPurchaseHistory member={member} />
      </div>

      {profile.editor && (
        <MemberProfileDialog memberName={member.name} editor={profile.editor} />
      )}
    </div>
  );
}
