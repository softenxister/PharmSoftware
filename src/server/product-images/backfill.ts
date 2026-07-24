export type ProductImageBackfillOptions = {
  apply: boolean;
  batchSize: number;
  maxItems: number;
  backupDirectory: string;
};

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_BACKUP_DIRECTORY = "outputs/product-image-backups";

function positiveInteger(value: string, flag: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${flag} must be a whole number from 1 to ${maximum}.`);
  }
  return parsed;
}

function valueAfter(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1]?.trim();
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

export function parseProductImageBackfillOptions(
  args: readonly string[],
): ProductImageBackfillOptions {
  const options: ProductImageBackfillOptions = {
    apply: false,
    batchSize: DEFAULT_BATCH_SIZE,
    maxItems: Number.MAX_SAFE_INTEGER,
    backupDirectory: DEFAULT_BACKUP_DIRECTORY,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--dry-run" || argument === "--status") {
      options.apply = false;
    } else if (argument === "--batch-size") {
      const value = valueAfter(args, index, argument);
      options.batchSize = positiveInteger(value, argument, 50);
      index += 1;
    } else if (argument === "--max-items") {
      const value = valueAfter(args, index, argument);
      options.maxItems = positiveInteger(value, argument);
      index += 1;
    } else if (argument === "--backup-dir") {
      options.backupDirectory = valueAfter(args, index, argument);
      index += 1;
    } else {
      throw new Error(`Unknown product-image option: ${argument}`);
    }
  }

  return options;
}

export function backfillHasRemainingCapacity(
  processed: number,
  options: Pick<ProductImageBackfillOptions, "maxItems">,
): boolean {
  return processed < options.maxItems;
}
