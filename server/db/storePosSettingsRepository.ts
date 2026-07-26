import { Prisma } from "@server/generated/prisma/client";
import {
  DEFAULT_STORE_POS_SETTINGS,
  normalizeStorePosSettings,
  type StorePosSettings,
} from "@/config/preferences/storePosSettings";
import { prisma } from "./prisma";

const PRIMARY_STORE_SETTINGS_ID = "primary-store";

type StorePosSettingsRow = {
  showProductLocation: boolean;
  paymentMethods: unknown;
};

export async function readStorePosSettings(): Promise<StorePosSettings> {
  const rows = await prisma.$queryRaw<StorePosSettingsRow[]>(Prisma.sql`
    SELECT "showProductLocation", "paymentMethods"
    FROM "StorePosSettings"
    WHERE "id" = ${PRIMARY_STORE_SETTINGS_ID}
    LIMIT 1
  `);
  return rows[0]
    ? normalizeStorePosSettings(rows[0])
    : { ...DEFAULT_STORE_POS_SETTINGS, paymentMethods: [...DEFAULT_STORE_POS_SETTINGS.paymentMethods] };
}

export async function saveStorePosSettings(
  settings: StorePosSettings,
  updatedBy: string,
): Promise<StorePosSettings> {
  const paymentMethods = JSON.stringify(settings.paymentMethods);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "StorePosSettings" (
      "id", "showProductLocation", "paymentMethods", "updatedBy", "createdAt", "updatedAt"
    ) VALUES (
      ${PRIMARY_STORE_SETTINGS_ID}, ${settings.showProductLocation}, ${paymentMethods}::jsonb, ${updatedBy}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "showProductLocation" = EXCLUDED."showProductLocation",
      "paymentMethods" = EXCLUDED."paymentMethods",
      "updatedBy" = EXCLUDED."updatedBy",
      "updatedAt" = CURRENT_TIMESTAMP
  `);
  return settings;
}
