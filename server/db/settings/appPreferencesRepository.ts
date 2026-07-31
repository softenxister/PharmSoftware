import { Prisma } from "@server/generated/prisma/client";
import {
  DEFAULT_APP_PREFERENCES,
  normalizeAppPreferences,
  type AppPreferences,
  type AppPreferencesPatch,
} from "@/config/preferences/appPreferences";
import { prisma } from "../core/prisma";

type AppPreferencesRow = {
  locale: string;
  colorTheme: string;
  memberDefaultSort: string;
  showArchivedMembers: boolean;
  analysisDefaultRange: string;
};

const PREFERENCE_COLUMNS = Prisma.raw(`
  "locale", "colorTheme", "memberDefaultSort", "showArchivedMembers", "analysisDefaultRange"
`);

export async function readAppPreferences(accountId: string): Promise<AppPreferences> {
  const rows = await prisma.$queryRaw<AppPreferencesRow[]>(Prisma.sql`
    SELECT ${PREFERENCE_COLUMNS}
    FROM "PharmAccountPreference"
    WHERE "accountId" = ${accountId}
    LIMIT 1
  `);
  return rows[0] ? normalizeAppPreferences(rows[0]) : { ...DEFAULT_APP_PREFERENCES };
}

export async function saveAppPreferences(
  accountId: string,
  patch: AppPreferencesPatch,
): Promise<AppPreferences> {
  const insertValues = { ...DEFAULT_APP_PREFERENCES, ...patch };
  const rows = await prisma.$queryRaw<AppPreferencesRow[]>(Prisma.sql`
    INSERT INTO "PharmAccountPreference" (
      "accountId", "locale", "colorTheme", "memberDefaultSort",
      "showArchivedMembers", "analysisDefaultRange", "createdAt", "updatedAt"
    ) VALUES (
      ${accountId}, ${insertValues.locale}, ${insertValues.colorTheme}, ${insertValues.memberDefaultSort},
      ${insertValues.showArchivedMembers}, ${insertValues.analysisDefaultRange}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("accountId") DO UPDATE SET
      "locale" = COALESCE(${patch.locale ?? null}, "PharmAccountPreference"."locale"),
      "colorTheme" = COALESCE(${patch.colorTheme ?? null}, "PharmAccountPreference"."colorTheme"),
      "memberDefaultSort" = COALESCE(${patch.memberDefaultSort ?? null}, "PharmAccountPreference"."memberDefaultSort"),
      "showArchivedMembers" = COALESCE(${patch.showArchivedMembers ?? null}, "PharmAccountPreference"."showArchivedMembers"),
      "analysisDefaultRange" = COALESCE(${patch.analysisDefaultRange ?? null}, "PharmAccountPreference"."analysisDefaultRange"),
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING ${PREFERENCE_COLUMNS}
  `);
  return normalizeAppPreferences(rows[0]);
}
