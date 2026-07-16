CREATE TABLE "PharmAccountPreference" (
    "accountId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "colorTheme" TEXT NOT NULL DEFAULT 'pharmacy-green',
    "memberDefaultSort" TEXT NOT NULL DEFAULT 'lastOrderAt',
    "showArchivedMembers" BOOLEAN NOT NULL DEFAULT false,
    "analysisDefaultRange" TEXT NOT NULL DEFAULT '30d',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PharmAccountPreference_pkey" PRIMARY KEY ("accountId"),
    CONSTRAINT "PharmAccountPreference_locale_check" CHECK ("locale" IN ('en', 'th')),
    CONSTRAINT "PharmAccountPreference_colorTheme_check" CHECK ("colorTheme" IN ('pharmacy-green', 'deep-forest', 'soft-neutral')),
    CONSTRAINT "PharmAccountPreference_memberDefaultSort_check" CHECK ("memberDefaultSort" IN ('lastOrderAt', 'name', 'registeredAt')),
    CONSTRAINT "PharmAccountPreference_analysisDefaultRange_check" CHECK ("analysisDefaultRange" IN ('today', '7d', '30d'))
);

ALTER TABLE "PharmAccountPreference"
ADD CONSTRAINT "PharmAccountPreference_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "PharmAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
