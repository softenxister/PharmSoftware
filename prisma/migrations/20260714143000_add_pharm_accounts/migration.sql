-- CreateEnum
CREATE TYPE "PharmAccountRole" AS ENUM ('OWNER', 'PHARMACIST');

-- CreateTable
CREATE TABLE "PharmAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "pharmacistLicenseNumber" TEXT,
    "avatarUrl" TEXT,
    "role" "PharmAccountRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "setupCompletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PharmAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "AuthLoginThrottle" (
    "keyHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthLoginThrottle_pkey" PRIMARY KEY ("keyHash")
);

-- Enforce this installation's single-owner rule at the database boundary.
CREATE UNIQUE INDEX "PharmAccount_single_owner" ON "PharmAccount"("role") WHERE "role" = 'OWNER';
CREATE UNIQUE INDEX "PharmAccount_username_key" ON "PharmAccount"("username");
CREATE INDEX "PharmAccount_role_isActive_idx" ON "PharmAccount"("role", "isActive");
CREATE INDEX "AuthSession_accountId_idx" ON "AuthSession"("accountId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

ALTER TABLE "PharmAccount" ADD CONSTRAINT "PharmAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PharmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PharmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Password is deliberately null: the login screen offers one-time owner setup.
INSERT INTO "PharmAccount" (
    "id", "username", "name", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt"
) VALUES (
    'primary-owner', 'owner', 'Pharmacy Owner', 'OWNER', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
