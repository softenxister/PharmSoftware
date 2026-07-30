import {
  formatPurchaseExpiryDate,
  formatPurchaseExpiryInput,
  isPurchaseExpiryDate,
  normalizeExpiryDate,
} from "@/lib/expiryDate";

export const formatExpiryDateInput = formatPurchaseExpiryInput;

export const formatDateDisplay = formatPurchaseExpiryDate;

export const isValidExpiryDate = isPurchaseExpiryDate;

export const toDatabaseExpiryDate = normalizeExpiryDate;

export const canSavePurchase = (lineCount: number, netTotal: number) =>
  Number.isInteger(lineCount) && lineCount > 0 && Number.isFinite(netTotal) && netTotal > 0;

export const getDistributorMatches = (distributors: string[], queryValue: string) => {
  const query = queryValue.trim().toLowerCase();
  const ranked = [...distributors].sort((a, b) => {
    const aName = a.toLowerCase();
    const bName = b.toLowerCase();
    const aStarts = query ? Number(!aName.startsWith(query)) : 0;
    const bStarts = query ? Number(!bName.startsWith(query)) : 0;
    return aStarts - bStarts || a.localeCompare(b);
  });

  if (!query) return ranked.slice(0, 6);
  return ranked.filter(name => name.toLowerCase().includes(query)).slice(0, 6);
};
