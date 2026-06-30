import type { UploadedRow } from "./purchaseData";

export const formatDateDisplay = (isoDate: string) => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year.slice(-2)}`;
};

export const money = (amount: number) =>
  `฿ ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const getPurchaseTotal = (rows: UploadedRow[]) =>
  rows.reduce((sum, row) => sum + Number(row.dist) * row.qty, 0);

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
