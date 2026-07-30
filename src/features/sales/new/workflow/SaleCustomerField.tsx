import { MemberAvatar } from '@/components/member/MemberAvatar';
import styles from '../NewSale.module.css';
import { PHARMACISTS } from './saleTypes';
import { CustomSelect, IconClose } from './SalePrimitives';
import type { SaleWorkflow } from './useSaleWorkflow';

export function SaleCustomerField({ sale }: { sale: SaleWorkflow }) {
  const {
    t,
    billDate,
    setBillDate,
    customerFieldRef,
    customer,
    formatNumber,
    setCustomer,
    setCustomerQuery,
    customerQuery,
    setCustomerDropdownOpen,
    setHighlightedCustomerIndex,
    handleCustomerSearchKeyDown,
    customerDropdownOpen,
    customerMatches,
    customerLoadError,
    highlightedCustomerIndex,
    selectCustomer,
    pharmacistId,
    setPharmacistId,
  } = sale;

  return (
    <div className={styles.metaRow}>
      <label className={`${styles.metaField} ${styles.dateField}`}>
        <span className={styles.metaLabel}>{t('newSale.billDate')}</span>
        <input type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} className={styles.dateInput} />
      </label>

      <div className={`${styles.metaField} ${styles.customerField}`} ref={customerFieldRef}>
        <span className={styles.metaLabel}>{t('sales.customer')}</span>
        {customer ? (
          <div className={styles.customerChip}>
            <MemberAvatar name={customer.name} avatarUrl={customer.avatarUrl} className={styles.avatar} />
            <div className={styles.customerChipMeta}>
              <span className={styles.customerChipName}>{customer.name}</span>
              <span className={styles.customerChipMobile}>
                {customer.mobile} · {customer.membershipRank} · {formatNumber(customer.points)} {t('newSale.pointsShort')}
              </span>
            </div>
            <button
              type="button"
              className={styles.clearChip}
              onClick={() => {
                setCustomer(null);
                setCustomerQuery('');
              }}
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
              onChange={(event) => {
                setCustomerQuery(event.target.value);
                setCustomerDropdownOpen(true);
              }}
              onFocus={() => {
                setCustomerDropdownOpen(true);
                setHighlightedCustomerIndex(0);
              }}
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
                      onMouseEnter={() => setHighlightedCustomerIndex(index)}
                      onMouseMove={() => setHighlightedCustomerIndex(index)}
                      onClick={() => selectCustomer(candidate)}
                    >
                      <MemberAvatar name={candidate.name} avatarUrl={candidate.avatarUrl} className={styles.avatar} />
                      <div className={styles.customerChipMeta}>
                        <span className={styles.customerChipName}>{candidate.name}</span>
                        <span className={styles.customerChipMobile}>
                          {candidate.mobile} · {candidate.membershipRank} · {formatNumber(candidate.points)} {t('newSale.pointsShort')}
                        </span>
                      </div>
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
          onChange={setPharmacistId}
        />
      </div>
    </div>
  );
}
