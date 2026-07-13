export type UploadedRow = {
  csv: string;
  item: string;
  lot: string;
  exp: string;
  dist: string;
  retail: string;
  qty: number;
  free: number;
};

const BUDDHIST_YEAR_OFFSET = 543;

const toChristianYear = (year: number) => year >= 2400 ? year - BUDDHIST_YEAR_OFFSET : year;

export const formatExpiryDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const rawYear = digits.slice(4, 8);
  const year = rawYear.length === 4 ? String(toChristianYear(Number(rawYear))) : rawYear;

  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
};

export const formatDateDisplay = (dateValue: string) => {
  if (!dateValue) return "";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  if (isoMatch) {
    const [, rawYear, month, day] = isoMatch;
    return `${day}/${month}/${toChristianYear(Number(rawYear))}`;
  }
  return formatExpiryDateInput(dateValue);
};

export const isValidExpiryDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
};

export const canSavePurchase = (lineCount: number, netTotal: number) =>
  Number.isInteger(lineCount) && lineCount > 0 && Number.isFinite(netTotal) && netTotal > 0;

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
