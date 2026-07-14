import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type {
  AccountProfileUpdate,
  OwnerSetupInput,
  StaffCreateInput,
} from "@/server/auth/accountValidation";
import {
  LOGIN_WINDOW_MS,
  hashLoginThrottleKey,
  type LoginThrottleRecord,
} from "@/server/auth/loginThrottle";
import type { PharmAccountRecord } from "@/server/auth/pharmUser";
import { prisma } from "./prisma";

type AccountRow = {
  id: string;
  username: string;
  passwordHash: string | null;
  name: string;
  phone: string;
  pharmacistLicenseNumber: string | null;
  avatarUrl: string | null;
  role: "OWNER" | "PHARMACIST";
  isActive: boolean;
  mustChangePassword: boolean;
  setupCompletedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PrivatePharmAccount = PharmAccountRecord & {
  passwordHash: string | null;
  setupCompletedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StaffAccountSummary = Omit<PrivatePharmAccount, "passwordHash" | "setupCompletedAt">;

const ACCOUNT_COLUMNS = Prisma.raw(`
  "id", "username", "passwordHash", "name", "phone",
  "pharmacistLicenseNumber", "avatarUrl", "role", "isActive",
  "mustChangePassword", "setupCompletedAt", "lastLoginAt", "createdAt", "updatedAt"
`);

function mapAccount(row: AccountRow): PrivatePharmAccount {
  return {
    ...row,
    role: row.role === "OWNER" ? "owner" : "pharmacist",
  };
}

export async function readOwnerSetupRequired(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ setupRequired: boolean }>>(Prisma.sql`
    SELECT ("passwordHash" IS NULL OR "setupCompletedAt" IS NULL) AS "setupRequired"
    FROM "PharmAccount"
    WHERE "role" = 'OWNER'
    LIMIT 1
  `);
  return rows[0]?.setupRequired ?? false;
}

export async function completeOwnerSetup(
  input: OwnerSetupInput,
  passwordHash: string,
): Promise<PrivatePharmAccount | null> {
  const rows = await prisma.$queryRaw<AccountRow[]>(Prisma.sql`
    UPDATE "PharmAccount"
    SET "name" = ${input.name},
        "username" = ${input.username},
        "phone" = ${input.phone},
        "passwordHash" = ${passwordHash},
        "setupCompletedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "role" = 'OWNER'
      AND ("passwordHash" IS NULL OR "setupCompletedAt" IS NULL)
    RETURNING ${ACCOUNT_COLUMNS}
  `);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function readAccountByUsername(username: string): Promise<PrivatePharmAccount | null> {
  const rows = await prisma.$queryRaw<AccountRow[]>(Prisma.sql`
    SELECT ${ACCOUNT_COLUMNS}
    FROM "PharmAccount"
    WHERE "username" = ${username}
    LIMIT 1
  `);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function readAccountBySessionHash(tokenHash: string): Promise<PrivatePharmAccount | null> {
  const rows = await prisma.$queryRaw<AccountRow[]>(Prisma.sql`
    SELECT ${Prisma.join([
      Prisma.raw('a."id"'), Prisma.raw('a."username"'), Prisma.raw('a."passwordHash"'),
      Prisma.raw('a."name"'), Prisma.raw('a."phone"'), Prisma.raw('a."pharmacistLicenseNumber"'),
      Prisma.raw('a."avatarUrl"'), Prisma.raw('a."role"'), Prisma.raw('a."isActive"'),
      Prisma.raw('a."mustChangePassword"'), Prisma.raw('a."setupCompletedAt"'),
      Prisma.raw('a."lastLoginAt"'), Prisma.raw('a."createdAt"'), Prisma.raw('a."updatedAt"'),
    ])}
    FROM "AuthSession" s
    INNER JOIN "PharmAccount" a ON a."id" = s."accountId"
    WHERE s."tokenHash" = ${tokenHash}
      AND s."expiresAt" > CURRENT_TIMESTAMP
      AND a."isActive" = true
    LIMIT 1
  `);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function createAuthSession(tokenHash: string, accountId: string, expiresAt: Date): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "AuthSession" ("tokenHash", "accountId", "expiresAt", "createdAt")
    VALUES (${tokenHash}, ${accountId}, ${expiresAt}, CURRENT_TIMESTAMP)
  `);
}

export async function deleteAuthSession(tokenHash: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "AuthSession" WHERE "tokenHash" = ${tokenHash}`);
}

export async function deleteAccountSessions(accountId: string, exceptTokenHash?: string): Promise<void> {
  if (exceptTokenHash) {
    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "AuthSession" WHERE "accountId" = ${accountId} AND "tokenHash" <> ${exceptTokenHash}
    `);
    return;
  }
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "AuthSession" WHERE "accountId" = ${accountId}`);
}

export async function markSuccessfulLogin(accountId: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "PharmAccount" SET "lastLoginAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${accountId}
  `);
}

export async function readLoginThrottle(username: string): Promise<LoginThrottleRecord | null> {
  const keyHash = hashLoginThrottleKey(username);
  const rows = await prisma.$queryRaw<LoginThrottleRecord[]>(Prisma.sql`
    SELECT "attempts", "windowStartedAt" FROM "AuthLoginThrottle" WHERE "keyHash" = ${keyHash} LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function recordFailedLogin(username: string, now = new Date()): Promise<void> {
  const keyHash = hashLoginThrottleKey(username);
  const windowStartLimit = new Date(now.getTime() - LOGIN_WINDOW_MS);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "AuthLoginThrottle" ("keyHash", "attempts", "windowStartedAt", "updatedAt")
    VALUES (${keyHash}, 1, ${now}, ${now})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "attempts" = CASE
        WHEN "AuthLoginThrottle"."windowStartedAt" <= ${windowStartLimit} THEN 1
        ELSE "AuthLoginThrottle"."attempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "AuthLoginThrottle"."windowStartedAt" <= ${windowStartLimit} THEN ${now}
        ELSE "AuthLoginThrottle"."windowStartedAt"
      END,
      "updatedAt" = ${now}
  `);
}

export async function clearLoginThrottle(username: string): Promise<void> {
  const keyHash = hashLoginThrottleKey(username);
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "AuthLoginThrottle" WHERE "keyHash" = ${keyHash}`);
}

export async function updateAccountProfile(
  accountId: string,
  input: AccountProfileUpdate,
): Promise<PrivatePharmAccount | null> {
  const rows = await prisma.$queryRaw<AccountRow[]>(Prisma.sql`
    UPDATE "PharmAccount"
    SET "name" = ${input.name},
        "username" = ${input.username},
        "phone" = ${input.phone},
        "pharmacistLicenseNumber" = CASE WHEN "role" = 'PHARMACIST' THEN ${input.pharmacistLicenseNumber} ELSE NULL END,
        "avatarUrl" = ${input.avatarUrl},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${accountId}
    RETURNING ${ACCOUNT_COLUMNS}
  `);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function updateAccountPassword(accountId: string, passwordHash: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "PharmAccount"
    SET "passwordHash" = ${passwordHash}, "mustChangePassword" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${accountId} AND "isActive" = true
  `);
}

export async function listPharmacistAccounts(): Promise<StaffAccountSummary[]> {
  const rows = await prisma.$queryRaw<AccountRow[]>(Prisma.sql`
    SELECT ${ACCOUNT_COLUMNS}
    FROM "PharmAccount"
    WHERE "role" = 'PHARMACIST'
    ORDER BY "isActive" DESC, "name" ASC
  `);
  return rows.map((row) => {
    const { passwordHash: _passwordHash, setupCompletedAt: _setupCompletedAt, ...account } = mapAccount(row);
    return account;
  });
}

export async function createPharmacistAccount(
  input: StaffCreateInput,
  passwordHash: string,
  ownerId: string,
): Promise<StaffAccountSummary> {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<AccountRow[]>(Prisma.sql`
    INSERT INTO "PharmAccount" (
      "id", "username", "passwordHash", "name", "phone", "pharmacistLicenseNumber",
      "role", "isActive", "mustChangePassword", "createdById", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.username}, ${passwordHash}, ${input.name}, ${input.phone}, ${input.pharmacistLicenseNumber},
      'PHARMACIST', true, true, ${ownerId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING ${ACCOUNT_COLUMNS}
  `);
  const { passwordHash: _passwordHash, setupCompletedAt: _setupCompletedAt, ...account } = mapAccount(rows[0]);
  return account;
}

export async function setPharmacistActive(staffId: string, isActive: boolean): Promise<boolean> {
  const result = await prisma.$executeRaw(Prisma.sql`
    UPDATE "PharmAccount" SET "isActive" = ${isActive}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${staffId} AND "role" = 'PHARMACIST'
  `);
  if (!isActive && result > 0) await deleteAccountSessions(staffId);
  return result > 0;
}

export async function resetPharmacistPassword(staffId: string, passwordHash: string): Promise<boolean> {
  const result = await prisma.$executeRaw(Prisma.sql`
    UPDATE "PharmAccount"
    SET "passwordHash" = ${passwordHash}, "mustChangePassword" = true, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${staffId} AND "role" = 'PHARMACIST'
  `);
  if (result > 0) await deleteAccountSessions(staffId);
  return result > 0;
}
