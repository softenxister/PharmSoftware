import {
  getPaymentMethodShortcut,
  STORE_PAYMENT_METHODS,
  type StorePaymentMethod,
} from "@/app/settings/storePosSettings";

type ShortcutKeyEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

type KeyboardShortcutTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type SaleShortcutAction =
  | { type: "save-pending" }
  | { type: "open-payment" }
  | { type: "select-payment"; method: StorePaymentMethod };

export function resolveSaleShortcut(
  event: ShortcutKeyEvent,
  enabledMethods: readonly StorePaymentMethod[],
): SaleShortcutAction | null {
  const commandKey = Boolean(event.ctrlKey || event.metaKey);
  if (commandKey && event.key.toLowerCase() === "s") return { type: "save-pending" };
  if (commandKey && event.key === "Enter") return { type: "open-payment" };

  const method = STORE_PAYMENT_METHODS.find((candidate) => getPaymentMethodShortcut(candidate) === event.key);
  if (!method || !enabledMethods.includes(method)) return null;
  return { type: "select-payment", method };
}

export function subscribeSaleShortcuts(
  target: KeyboardShortcutTarget,
  listener: (event: KeyboardEvent) => void,
): () => void {
  const handleKeyDown: EventListener = (event) => listener(event as KeyboardEvent);
  target.addEventListener("keydown", handleKeyDown);
  return () => target.removeEventListener("keydown", handleKeyDown);
}
