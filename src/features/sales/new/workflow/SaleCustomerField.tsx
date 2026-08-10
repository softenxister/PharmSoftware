import { MemberAvatar } from '@/components/member/MemberAvatar';
import { FormattedDateInput } from '@/components/forms/FormattedDateInput';
import {
  memberRankVisual,
  type MemberRankIcon,
  type MemberRankTone,
} from '@/features/member/memberData';
import { normalizeMembershipRank } from '@/lib/membershipRank';
import { Crown, Gem, Medal, Phone, Star } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import styles from '../NewSale.module.css';
import { PHARMACISTS, type Customer } from './saleTypes';
import { CustomSelect, IconClose } from './SalePrimitives';
import type { SaleCustomerFieldModel } from './useSaleWorkflow';

const rankToneClasses = {
  bronze: styles.customerRankBronze,
  silver: styles.customerRankSilver,
  gold: styles.customerRankGold,
  platinum: styles.customerRankPlatinum,
  diamond: styles.customerRankDiamond,
} satisfies Record<MemberRankTone, string>;

function BronzeMedal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none">
      <path
        d="M8.3 13v8l3.7-2.25L15.7 21v-8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="8.5"
        r="6.5"
        fill="white"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m12 4.7 1.15 2.32 2.56.37-1.85 1.81.44 2.55L12 10.54l-2.3 1.21.44-2.55-1.85-1.81 2.56-.37L12 4.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlatinumShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5C9.5 4.2 6.6 4.8 4 4.8v6.4c0 4.9 3.1 8.4 8 10.3 4.9-1.9 8-5.4 8-10.3V4.8c-2.6 0-5.5-.6-8-2.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 6c-1.7 1-3.3 1.35-4.8 1.45v3.7c0 3.1 1.75 5.25 4.8 6.75 3.05-1.5 4.8-3.65 4.8-6.75v-3.7C15.3 7.35 13.7 7 12 6Z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const rankIconComponents = {
  bronze: BronzeMedal,
  medal: Medal,
  crown: Crown,
  platinum: PlatinumShield,
  diamond: Gem,
} satisfies Record<MemberRankIcon, ComponentType<SVGProps<SVGSVGElement>>>;

function CustomerDetailColumns({
  customer,
  formatNumber,
  pointsLabel,
}: {
  customer: Customer;
  formatNumber: (value: number) => string;
  pointsLabel: string;
}) {
  const rankLabel = normalizeMembershipRank(customer.membershipRank);
  const rankVisual = memberRankVisual(rankLabel);
  const RankIcon = rankIconComponents[rankVisual.icon];

  return (
    <div className={styles.customerChipMeta}>
      <span className={styles.customerChipName}>{customer.name}</span>
      <span className={`${styles.customerMetaCell} ${styles.customerChipMobile}`}>
        <Phone className={styles.customerMetaIcon} aria-hidden="true" />
        <span className={styles.customerMetaText}>{customer.mobile}</span>
      </span>
      <span className={`${styles.customerMetaCell} ${styles.customerChipRank} ${rankToneClasses[rankVisual.tone]}`}>
        <RankIcon className={styles.customerMetaIcon} aria-hidden="true" />
        <span className={styles.customerMetaText}>{rankLabel}</span>
      </span>
      <span className={`${styles.customerMetaCell} ${styles.customerChipPoints}`}>
        <Star className={styles.customerMetaIcon} aria-hidden="true" fill="currentColor" />
        <span className={styles.customerMetaText}>
          {formatNumber(customer.points)} {pointsLabel}
        </span>
      </span>
    </div>
  );
}

export function SaleCustomerField({ model }: { model: SaleCustomerFieldModel }) {
  const {
    t,
    billDate,
    changeBillDate,
    customerFieldRef,
    customer,
    formatNumber,
    clearCustomer,
    changeCustomerQuery,
    customerQuery,
    focusCustomerSearch,
    handleCustomerSearchKeyDown,
    customerDropdownOpen,
    customerMatches,
    customerLoadError,
    highlightedCustomerIndex,
    highlightCustomer,
    selectCustomer,
    pharmacistId,
    choosePharmacist,
  } = model;

  return (
    <div className={styles.metaRow}>
      <div className={`${styles.metaField} ${styles.dateField}`}>
        <label className={styles.metaLabel} htmlFor="sale-bill-date">{t('newSale.billDate')}</label>
        <FormattedDateInput
          id="sale-bill-date"
          value={billDate}
          onChange={changeBillDate}
          calendarLabel={t('purchaseEntry.openCalendar', { label: t('newSale.billDate') })}
        />
      </div>

      <div className={`${styles.metaField} ${styles.customerField}`} ref={customerFieldRef}>
        <span className={styles.metaLabel}>{t('sales.customer')}</span>
        {customer ? (
          <div className={styles.customerChip}>
            <MemberAvatar name={customer.name} avatarUrl={customer.avatarUrl} className={styles.avatar} />
            <CustomerDetailColumns
              customer={customer}
              formatNumber={formatNumber}
              pointsLabel={t('newSale.pointsShort')}
            />
            <button
              type="button"
              className={styles.clearChip}
              onClick={clearCustomer}
              aria-label={t('newSale.clearCustomer')}
            >
              <IconClose />
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={customerQuery}
              onChange={(event) => changeCustomerQuery(event.target.value)}
              onFocus={focusCustomerSearch}
              onKeyDown={handleCustomerSearchKeyDown}
              placeholder={t('newSale.searchCustomer')}
              className={styles.textInput}
            />
            {customerDropdownOpen && (
              <div className={styles.dropdownPanel}>
                {customerMatches.length === 0 && (
                  <div className={styles.dropdownEmpty}>{customerLoadError || t('newSale.noCustomer')}</div>
                )}
                {customerMatches.map((candidate, index) => {
                  const isHighlighted = index === highlightedCustomerIndex;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      className={`${styles.customerOption} ${isHighlighted ? styles.customerOptionActive : ''}`}
                      aria-selected={isHighlighted}
                      onMouseEnter={() => highlightCustomer(index)}
                      onMouseMove={() => highlightCustomer(index)}
                      onClick={() => selectCustomer(candidate)}
                    >
                      <MemberAvatar name={candidate.name} avatarUrl={candidate.avatarUrl} className={styles.avatar} />
                      <CustomerDetailColumns
                        customer={candidate}
                        formatNumber={formatNumber}
                        pointsLabel={t('newSale.pointsShort')}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className={`${styles.metaField} ${styles.pharmacistField}`}>
        <span className={styles.metaLabel}>{t('common.pharmacist')}</span>
        <CustomSelect
          ariaLabel={t('common.pharmacist')}
          value={pharmacistId}
          options={PHARMACISTS.map((pharmacist) => ({ value: pharmacist.id, label: pharmacist.name }))}
          onChange={choosePharmacist}
        />
      </div>
    </div>
  );
}
