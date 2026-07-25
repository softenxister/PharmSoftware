export type StockEntryMode = "create" | "edit";

type SelectableTextInput = {
  select(): void;
};

type StockSaveShortcutInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
};

export function isStockSaveShortcut(
  mode: StockEntryMode,
  input: StockSaveShortcutInput,
): boolean {
  return mode === "edit"
    && input.key.toLowerCase() === "s"
    && (input.ctrlKey || input.metaKey)
    && !input.altKey
    && !input.shiftKey
    && !input.repeat;
}

export function selectStockIdentityText(
  mode: StockEntryMode,
  input: SelectableTextInput,
): void {
  if (mode === "edit") input.select();
}
