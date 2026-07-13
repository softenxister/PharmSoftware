export type PurchaseWorkflowStatus = "draft" | "partial" | "received";

const allowedTransitions: Record<PurchaseWorkflowStatus, PurchaseWorkflowStatus[]> = {
  draft: ["partial"],
  partial: ["draft", "received"],
  received: [],
};

export const canTransitionPurchaseStatus = (
  currentStatus: PurchaseWorkflowStatus,
  nextStatus: PurchaseWorkflowStatus,
) => allowedTransitions[currentStatus].includes(nextStatus);

export const purchaseStatusLabel: Record<PurchaseWorkflowStatus, string> = {
  draft: "Draft",
  partial: "Ready to review",
  received: "Completed",
};
