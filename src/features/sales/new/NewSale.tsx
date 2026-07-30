import type { PharmUser } from '@server/auth/pharmUser';
import styles from './NewSale.module.css';
import { PosConfirmationDialog } from './PosConfirmationDialog';
import { SaleCartTable } from './workflow/SaleCartTable';
import { SaleCompletionDialog } from './workflow/SaleCompletionDialog';
import { SaleCustomerField } from './workflow/SaleCustomerField';
import { SaleItemEntry } from './workflow/SaleItemEntry';
import { SalePaymentPanel } from './workflow/SalePaymentPanel';
import { SaleProductBrowser } from './workflow/SaleProductBrowser';
import { SaleReminderPanel } from './workflow/SaleReminderPanel';
import { SaleSettingsDialog } from './workflow/SaleSettingsDialog';
import { SaleSummaryBar } from './workflow/SaleSummaryBar';
import { SaleToolbar } from './workflow/SaleToolbar';
import { useSaleWorkflow } from './workflow/useSaleWorkflow';

export default function NewSale({ user }: { user: PharmUser }): React.ReactElement {
  const sale = useSaleWorkflow(user);
  const { pendingConfirmation, setPendingConfirmation, confirmPendingAction, t } = sale;

  return (
    <div className={styles.page}>
      <SaleToolbar sale={sale} />
      <SaleCustomerField sale={sale} />
      <div className={styles.scrollArea}>
        <SaleItemEntry sale={sale} />
        <SaleCartTable sale={sale} />
        <SaleProductBrowser sale={sale} />
      </div>
      <SaleSummaryBar sale={sale} />
      <SaleReminderPanel sale={sale} />
      <SaleSettingsDialog sale={sale} />
      <SalePaymentPanel sale={sale} />
      <SaleCompletionDialog sale={sale} />
      <PosConfirmationDialog
        open={pendingConfirmation !== null}
        title={pendingConfirmation?.kind === 'remove-item'
          ? t('newSale.removeQuestion')
          : t('newSale.cancelQuestion')}
        description={pendingConfirmation?.kind === 'remove-item'
          ? t('newSale.removeDescription', { name: pendingConfirmation.itemName })
          : t('newSale.cancelDescription')}
        confirmLabel={pendingConfirmation?.kind === 'remove-item'
          ? t('newSale.removeItem')
          : t('newSale.cancelSale')}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
}
