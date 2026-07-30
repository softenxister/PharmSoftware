import { Edit3 } from "lucide-react";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import { MemberAvatar } from "@/components/member/MemberAvatar";
import { formatThaiPhoneNumberList } from "@/lib/thaiPhoneNumber";
import type { MemberDetailRecord } from "./memberProfileTypes";
import styles from "./MemberDetail.module.css";

type MemberSummaryProps = {
  member: MemberDetailRecord;
  avatarUrl?: string | null;
  onEdit: () => void;
};

export function MemberSummary({ member, avatarUrl = member.avatarUrl, onEdit }: MemberSummaryProps) {
  const { t, formatDate, formatMoney, formatNumber } = usePreferences();

  return (
    <>
      <header className={styles.profileHeader}>
        <div className={styles.identity}>
          <MemberAvatar name={member.name} avatarUrl={avatarUrl} className={styles.avatar} />
          <div className={styles.identityText}>
            <p>{t("member.profile")}</p>
            <h1 title={member.name}>{member.name}</h1>
            <span>
              {formatThaiPhoneNumberList(member.mobile)}
              {" · "}
              {t("member.memberId")}: {member.id}
            </span>
          </div>
        </div>
        <button type="button" className={styles.editButton} onClick={onEdit}>
          <Edit3 size={16} aria-hidden="true" />
          {t("member.editProfile")}
        </button>
      </header>

      <section className={styles.summaryGrid} aria-label={t("member.memberSummary")}>
        <div className={styles.summaryCard}>
          <span>{t("member.rank")}</span>
          <strong className={styles.rankValue}>{member.membershipRank}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>{t("member.points")}</span>
          <strong>{formatNumber(member.points)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>{t("member.totalPurchase")}</span>
          <strong>฿{formatMoney(member.totalPurchase)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>{t("member.paidBills")}</span>
          <strong>{formatNumber(member.paidTransactionCount)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>{t("member.registered")}</span>
          <strong>{formatDate(member.registeredAt)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>{t("member.lastOrder")}</span>
          <strong>
            {member.lastOrderAt ? formatDate(member.lastOrderAt) : t("member.noPurchases")}
          </strong>
        </div>
      </section>
    </>
  );
}
