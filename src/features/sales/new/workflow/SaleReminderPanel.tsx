import morningReminderIcon from '@/styles/vector/morning.png';
import noonReminderIcon from '@/styles/vector/noon.png';
import eveningReminderIcon from '@/styles/vector/evening.png';
import nightReminderIcon from '@/styles/vector/night.png';
import styles from '../NewSale.module.css';
import { createReminderFromDefaultDosage, totalTabsForLine } from './saleDraft';
import { IconClose } from './SalePrimitives';
import type { SaleReminderPanelModel } from './useSaleWorkflow';

const REMINDER_TIMES = [
  { label: '8 AM', icon: morningReminderIcon },
  { label: '1 PM', icon: noonReminderIcon },
  { label: '7 PM', icon: eveningReminderIcon },
  { label: '10 PM', icon: nightReminderIcon },
] as const;

export function SaleReminderPanel({ model }: { model: SaleReminderPanelModel }) {
  const {
    t,
    reminderOpen,
    closeReminder,
    reminderEligibleLines,
    catalog,
    reminderRows,
    formatNumber,
    localizeUnit,
    showProductLocation,
    toggleReminderLine,
    chooseReminderTime,
    navigateReminderTime,
    changeReminderDose,
  } = model;

  if (!reminderOpen) return null;

  return (
    <div className={styles.reminderBackdrop} onClick={closeReminder}>
      <div className={styles.reminderCard} role="dialog" aria-modal="true" aria-labelledby="pill-reminder-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <h2 id="pill-reminder-title" className={styles.drawerTitle}>{t('newSale.pillReminder')}</h2>
          <button type="button" className={styles.drawerClose} onClick={closeReminder} aria-label={t('newSale.closeReminder')}>
            <IconClose />
          </button>
        </div>

        {reminderEligibleLines.length === 0 ? (
          <div className={styles.reminderEmpty}>{t('newSale.noReminderItems')}</div>
        ) : (
          <div className={styles.reminderTableWrap}>
            <table className={styles.reminderTable}>
              <thead>
                <tr>
                  <th>{t('newSale.drugItem')}</th>
                  {REMINDER_TIMES.map((time) => (
                    <th key={time.label}>
                      <span className={styles.reminderTimeHead}>
                        <img src={time.icon} alt={time.label} className={styles.reminderTimeIcon} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reminderEligibleLines.map((line) => {
                  const catalogItem = catalog.find((item) => item.id === line.itemId);
                  const reminder = reminderRows[line.lineId]
                    ?? createReminderFromDefaultDosage(catalogItem?.defaultDosage);
                  const totalTabs = totalTabsForLine(line, catalog);
                  return (
                    <tr key={line.lineId} className={!reminder.enabled ? styles.reminderRowMuted : ''}>
                      <td>
                        <label className={styles.reminderDrug}>
                          <input type="checkbox" checked={reminder.enabled} onChange={() => toggleReminderLine(line.lineId)} />
                          <span className={styles.reminderDrugText}>
                            <span className={styles.reminderDrugName}>{line.itemName}</span>
                            <span className={styles.reminderDrugSub}>
                              {t('newSale.tabsTotal', { count: formatNumber(totalTabs) })} | {localizeUnit(catalogItem?.packLabel ?? line.packLabel)} | {localizeUnit(line.packLabel)}
                              {showProductLocation ? ` | ${line.loc}` : ''}
                            </span>
                          </span>
                        </label>
                      </td>
                      {REMINDER_TIMES.map((time, index) => (
                        <td key={time.label}>
                          <button
                            type="button"
                            className={`${styles.reminderDoseButton} ${reminder.activeTime === index ? styles.reminderDoseButtonActive : ''}`}
                            data-reminder-line={line.lineId}
                            data-reminder-time={index}
                            onClick={() => chooseReminderTime(line.lineId, index)}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowLeft') {
                                event.preventDefault();
                                navigateReminderTime(line.lineId, index, -1);
                              } else if (event.key === 'ArrowRight') {
                                event.preventDefault();
                                navigateReminderTime(line.lineId, index, 1);
                              } else if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                changeReminderDose(line.lineId, index, 1);
                              } else if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                changeReminderDose(line.lineId, index, -1);
                              }
                            }}
                            disabled={!reminder.enabled}
                            aria-label={`${line.itemName}, ${time.label}, ${reminder.doses[index]} tab`}
                          >
                            {reminder.doses[index]}
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
