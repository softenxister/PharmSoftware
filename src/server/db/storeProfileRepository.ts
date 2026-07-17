import { Prisma } from "@/generated/prisma/client";
import { EMPTY_STORE_PROFILE, type StoreProfile } from "@/app/settings/storeProfile";
import { prisma } from "./prisma";

const PRIMARY_STORE_ID = "primary-store";

type StoreProfileRow = Omit<StoreProfile, "imageUrl"> & {
  hasImage: boolean;
  imageUpdatedAt: Date | null;
};

type StoreImageRow = {
  imageData: Uint8Array;
  imageMimeType: string;
};

const toStoreProfile = (row: StoreProfileRow): StoreProfile => ({
  storeName: row.storeName,
  phone: row.phone,
  email: row.email,
  taxId: row.taxId,
  pharmacyLicense: row.pharmacyLicense,
  address: row.address,
  lineId: row.lineId,
  facebookPage: row.facebookPage,
  openingTime: row.openingTime,
  closingTime: row.closingTime,
  imageUrl: row.hasImage
    ? `/api/store-profile/image?v=${row.imageUpdatedAt?.getTime() ?? 0}`
    : null,
});

export async function readStoreProfile(): Promise<StoreProfile> {
  const rows = await prisma.$queryRaw<StoreProfileRow[]>(Prisma.sql`
    SELECT
      "storeName", phone, email, "taxId", "pharmacyLicense", address, "lineId", "facebookPage",
      "openingTime", "closingTime",
      ("imageData" IS NOT NULL AND "imageMimeType" IS NOT NULL) AS "hasImage",
      "imageUpdatedAt"
    FROM "StoreProfile"
    WHERE id = ${PRIMARY_STORE_ID}
    LIMIT 1
  `);
  return rows[0] ? toStoreProfile(rows[0]) : { ...EMPTY_STORE_PROFILE };
}

export async function saveStoreProfile(profile: StoreProfile, updatedBy: string): Promise<StoreProfile> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "StoreProfile" (
      id, "storeName", phone, email, "taxId", "pharmacyLicense", address, "lineId", "facebookPage",
      "openingTime", "closingTime",
      "updatedBy", "createdAt", "updatedAt"
    ) VALUES (
      ${PRIMARY_STORE_ID}, ${profile.storeName}, ${profile.phone}, ${profile.email}, ${profile.taxId},
      ${profile.pharmacyLicense}, ${profile.address}, ${profile.lineId}, ${profile.facebookPage},
      ${profile.openingTime}, ${profile.closingTime},
      ${updatedBy}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      "storeName" = EXCLUDED."storeName",
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      "taxId" = EXCLUDED."taxId",
      "pharmacyLicense" = EXCLUDED."pharmacyLicense",
      address = EXCLUDED.address,
      "lineId" = EXCLUDED."lineId",
      "facebookPage" = EXCLUDED."facebookPage",
      "openingTime" = EXCLUDED."openingTime",
      "closingTime" = EXCLUDED."closingTime",
      "updatedBy" = EXCLUDED."updatedBy",
      "updatedAt" = CURRENT_TIMESTAMP
  `);
  return readStoreProfile();
}

export async function readStoreProfileImage(): Promise<StoreImageRow | null> {
  const rows = await prisma.$queryRaw<StoreImageRow[]>(Prisma.sql`
    SELECT "imageData", "imageMimeType"
    FROM "StoreProfile"
    WHERE id = ${PRIMARY_STORE_ID} AND "imageData" IS NOT NULL AND "imageMimeType" IS NOT NULL
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function saveStoreProfileImage(
  imageData: Uint8Array,
  imageMimeType: string,
  updatedBy: string,
): Promise<StoreProfile> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "StoreProfile" (
      id, "storeName", "imageData", "imageMimeType", "imageUpdatedAt", "updatedBy", "createdAt", "updatedAt"
    ) VALUES (
      ${PRIMARY_STORE_ID}, 'RxPro Pharmacy', ${imageData}, ${imageMimeType}, CURRENT_TIMESTAMP,
      ${updatedBy}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      "imageData" = EXCLUDED."imageData",
      "imageMimeType" = EXCLUDED."imageMimeType",
      "imageUpdatedAt" = CURRENT_TIMESTAMP,
      "updatedBy" = EXCLUDED."updatedBy",
      "updatedAt" = CURRENT_TIMESTAMP
  `);
  return readStoreProfile();
}
