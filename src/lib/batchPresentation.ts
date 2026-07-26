export function normalizeOptionalBatchNo(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function displayBatchField(value: string | null | undefined): string {
  return normalizeOptionalBatchNo(value) ?? "-";
}

function expiryTimestamp(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  const date = dayFirst
    ? new Date(Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1])))
    : new Date(normalized);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function nearestAvailableExpiryBatch<T>(
  batches: readonly T[],
  expiryDate: (batch: T) => string,
  availableStock: (batch: T) => number,
): T | null {
  const available = batches
    .map((batch, index) => ({ batch, index }))
    .filter(({ batch }) => availableStock(batch) > 0);
  const dated = available.flatMap(({ batch, index }) => {
    const timestamp = expiryTimestamp(expiryDate(batch));
    return timestamp === null ? [] : [{ batch, index, timestamp }];
  });

  if (dated.length > 0) {
    dated.sort((left, right) => left.timestamp - right.timestamp || left.index - right.index);
    return dated[0].batch;
  }
  return available[0]?.batch ?? null;
}
