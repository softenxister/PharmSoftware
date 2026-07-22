-- Add the optional CW distributor business identifier without changing existing records.
ALTER TABLE "Distributor" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "Distributor_code_key" ON "Distributor"("code");
