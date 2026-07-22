-- Phone numbers are contact data, not a unique customer identity.
DROP INDEX IF EXISTS "Customer_mobile_key";

CREATE INDEX IF NOT EXISTS "Customer_mobile_idx" ON "Customer"("mobile");
