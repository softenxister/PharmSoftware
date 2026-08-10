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
  const workflow = useSaleWorkflow(user);
  const confirmation = workflow.confirmationDialog;

  return (
    <div className={styles.page}>
      <SaleToolbar model={workflow.toolbar} />
      <SaleCustomerField model={workflow.customerField} />
      <div className={styles.scrollArea}>
        <SaleItemEntry model={workflow.itemEntry} />
        <SaleCartTable model={workflow.cartTable} />
        <SaleProductBrowser model={workflow.productBrowser} />
      </div>
      <SaleSummaryBar model={workflow.summaryBar} />
      <SaleReminderPanel model={workflow.reminderPanel} />
      <SaleSettingsDialog model={workflow.settingsDialog} />
      <SalePaymentPanel model={workflow.paymentPanel} />
      <SaleCompletionDialog model={workflow.completionDialog} />
      <PosConfirmationDialog
        open={confirmation.open}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        onCancel={confirmation.cancel}
        onConfirm={confirmation.confirm}
      />
    </div>
  );
}
