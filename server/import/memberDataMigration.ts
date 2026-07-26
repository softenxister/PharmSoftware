import { createHash } from "node:crypto";
import { formatThaiPhoneNumber, isValidThaiPhoneNumber } from "@/lib/thaiPhoneNumber";

export const MEMBER_DATA_HEADERS = [
  "รหัสสมาชิก",
  "ชื่อ-สกุล",
  "ที่อยู่",
  "โทรศัพท์",
  "เริ่มเป็นสมาชิก",
] as const;

export type MemberMigrationStatus = "new" | "update" | "conflict";
export type MemberPhoneStatus = "valid" | "empty" | "invalid";

export type ExistingCustomerIdentity = {
  id: string;
  memberCode: string | null;
  mobile: string | null;
};

export type MemberDataMigrationRow = {
  rowNumber: number;
  memberCode: string;
  name: string;
  address: string | null;
  rawPhone: string;
  phoneStatus: MemberPhoneStatus;
  rawMembershipStartedAt: string;
  status: MemberMigrationStatus;
  matchedCustomerId: string | null;
  issue: string | null;
  warning: string | null;
};

export type MemberDataMigrationPreview = {
  sourceSoftware: "CW";
  confirmationToken: string;
  summary: {
    totalRows: number;
    newCount: number;
    updateCount: number;
    conflictCount: number;
    phoneNullCount: number;
  };
  rows: MemberDataMigrationRow[];
};

export type MemberDataImportRow = MemberDataMigrationRow & {
  mobile: string | null;
  membershipStartedAt: Date | null;
};

export type PreparedMemberDataMigration = {
  preview: MemberDataMigrationPreview;
  importRows: MemberDataImportRow[];
};

function parseCsvRows(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length === 0) throw new Error("CSV contains no rows.");
  return rows;
}

type SourceRecord = Record<(typeof MEMBER_DATA_HEADERS)[number], string> & { rowNumber: number };

function recordsFromCsv(csvText: string): SourceRecord[] {
  const rows = parseCsvRows(csvText);
  const headers = rows[0].map((header) => header.trim());
  const missingHeaders = MEMBER_DATA_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingHeaders.join(", ")}`);
  }
  return rows.slice(1).map((row, index) => Object.fromEntries([
    ...MEMBER_DATA_HEADERS.map((header) => [header, row[headers.indexOf(header)] ?? ""]),
    ["rowNumber", index + 2],
  ]) as SourceRecord);
}

function normalizeImportedMemberSinglePhone(rawPhone: string): string | null {
  const value = rawPhone.trim();
  if (!value || !/^[0-9\s-]+$/.test(value)) return null;
  let digits = value.replace(/[\s-]/g, "");
  if (isValidThaiPhoneNumber(digits)) return formatThaiPhoneNumber(digits);
  if (digits.length === 8 && digits.startsWith("2")) digits = `0${digits}`;
  else if (digits.length === 9 && !digits.startsWith("0")) digits = `0${digits}`;
  else if (digits.startsWith("66")) digits = `0${digits.slice(2)}`;
  if (!isValidThaiPhoneNumber(digits)) return null;
  return formatThaiPhoneNumber(digits);
}

function normalizedPhoneParts(rawPhone: string | null): string[] {
  if (!rawPhone) return [];
  return rawPhone.split(",").flatMap((phone) => {
    const normalized = normalizeImportedMemberSinglePhone(phone);
    return normalized ? [normalized] : [];
  });
}

export function normalizeImportedMemberPhone(rawPhone: string): string | null {
  const phones = rawPhone.split(",").map(normalizeImportedMemberSinglePhone);
  if (phones.length === 0 || phones.some((phone) => phone === null)) return null;
  return phones.join(",");
}

function parseMembershipStartedAt(rawValue: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rawValue.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function requiredValueIssue(row: MemberDataImportRow): string | null {
  if (!row.memberCode) return "Member code is required.";
  if (row.memberCode.length > 100) return "Member code must be 100 characters or fewer.";
  if (!row.name) return "Member name is required.";
  if (row.name.length > 100) return "Member name must be 100 characters or fewer.";
  if (row.address && row.address.length > 500) return "Address must be 500 characters or fewer.";
  if (!row.membershipStartedAt) return "Membership start date must use DD/MM/YYYY.";
  return null;
}

function confirmationToken(csvText: string, rows: readonly MemberDataImportRow[]): string {
  const reconciliation = rows.map((row) => ({
    rowNumber: row.rowNumber,
    memberCode: row.memberCode,
    mobile: row.mobile,
    status: row.status,
    matchedCustomerId: row.matchedCustomerId,
    issue: row.issue,
    warning: row.warning,
  }));
  return createHash("sha256")
    .update(csvText, "utf8")
    .update("\0", "utf8")
    .update(JSON.stringify(reconciliation), "utf8")
    .digest("hex");
}

export function prepareMemberDataMigration(
  csvText: string,
  existingCustomers: readonly ExistingCustomerIdentity[],
): PreparedMemberDataMigration {
  const importRows: MemberDataImportRow[] = recordsFromCsv(csvText).map((record) => {
    const rawPhone = record["โทรศัพท์"];
    const mobile = normalizeImportedMemberPhone(rawPhone);
    const rawMembershipStartedAt = record["เริ่มเป็นสมาชิก"];
    return {
      rowNumber: record.rowNumber,
      memberCode: record["รหัสสมาชิก"].trim(),
      name: record["ชื่อ-สกุล"].trim(),
      address: record["ที่อยู่"].trim() || null,
      rawPhone,
      phoneStatus: rawPhone.trim() ? (mobile ? "valid" : "invalid") : "empty",
      rawMembershipStartedAt,
      status: "new",
      matchedCustomerId: null,
      issue: null,
      warning: null,
      mobile,
      membershipStartedAt: parseMembershipStartedAt(rawMembershipStartedAt),
    };
  });

  const codeCounts = new Map<string, number>();
  const uploadedPhoneCounts = new Map<string, number>();
  for (const row of importRows) {
    if (row.memberCode) codeCounts.set(row.memberCode, (codeCounts.get(row.memberCode) ?? 0) + 1);
    for (const phone of normalizedPhoneParts(row.mobile)) {
      uploadedPhoneCounts.set(phone, (uploadedPhoneCounts.get(phone) ?? 0) + 1);
    }
  }

  const existingByCode = new Map(existingCustomers.flatMap((customer) => (
    customer.memberCode ? [[customer.memberCode, customer] as const] : []
  )));
  const existingCustomerIdsByPhone = new Map<string, Set<string>>();
  for (const customer of existingCustomers) {
    for (const phone of normalizedPhoneParts(customer.mobile)) {
      const customerIds = existingCustomerIdsByPhone.get(phone) ?? new Set<string>();
      customerIds.add(customer.id);
      existingCustomerIdsByPhone.set(phone, customerIds);
    }
  }

  for (const row of importRows) {
    const codeMatch = existingByCode.get(row.memberCode) ?? null;
    row.matchedCustomerId = codeMatch?.id ?? null;
    const duplicatePhones = [...new Set(normalizedPhoneParts(row.mobile))].filter((phone) => (
      (uploadedPhoneCounts.get(phone) ?? 0) > 1
      || [...(existingCustomerIdsByPhone.get(phone) ?? [])].some((customerId) => customerId !== codeMatch?.id)
    ));
    row.warning = duplicatePhones.length > 0
      ? `Duplicate phone warning: ${duplicatePhones.join(", ")}. Import will continue.`
      : null;
    row.issue = requiredValueIssue(row);
    if (!row.issue && (codeCounts.get(row.memberCode) ?? 0) > 1) {
      row.issue = "Duplicate member code in the uploaded CSV.";
    }
    row.status = row.issue ? "conflict" : codeMatch ? "update" : "new";
  }

  const count = (status: MemberMigrationStatus) => (
    importRows.filter((row) => row.status === status).length
  );
  return {
    importRows,
    preview: {
      sourceSoftware: "CW",
      confirmationToken: confirmationToken(csvText, importRows),
      summary: {
        totalRows: importRows.length,
        newCount: count("new"),
        updateCount: count("update"),
        conflictCount: count("conflict"),
        phoneNullCount: importRows.filter((row) => row.phoneStatus !== "valid").length,
      },
      rows: importRows.map(({ mobile: _mobile, membershipStartedAt: _startedAt, ...row }) => row),
    },
  };
}

export function buildMemberDataMigrationPreview(
  csvText: string,
  existingCustomers: readonly ExistingCustomerIdentity[],
): MemberDataMigrationPreview {
  return prepareMemberDataMigration(csvText, existingCustomers).preview;
}
