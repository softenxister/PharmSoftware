import assert from "node:assert/strict";
import test from "node:test";
import type { DistributorDataMigrationRow } from "@/server/import/distributorDataMigration";
import {
  buildDistributorImportWrite,
  DISTRIBUTOR_DATA_MIGRATION_TRANSACTION_OPTIONS,
} from "./distributorDataMigrationRepository";

const updateRow: DistributorDataMigrationRow = {
  rowNumber: 8,
  code: "SPR-1",
  name: "บริษัท อ้วยอันโอสถ จำกัด",
  status: "update",
  matchReason: "name",
  matchedDistributorId: "distributor-existing",
  matchedDistributorName: "บริษัท อ้วยอันโอสถ จำกัด",
  issue: null,
};

test("distributor import writes only code and name while targeting the reconciled identity", () => {
  const write = buildDistributorImportWrite(updateRow, "distributor-new");

  assert.equal(write.id, "distributor-existing");
  assert.deepEqual(write.update, { code: "SPR-1", name: "บริษัท อ้วยอันโอสถ จำกัด" });
  assert.deepEqual(write.create, {
    id: "distributor-existing",
    code: "SPR-1",
    name: "บริษัท อ้วยอันโอสถ จำกัด",
  });
  assert.equal("phone" in write.update, false);
  assert.equal("email" in write.update, false);
});

test("new distributor import uses the generated id and serializable transaction", () => {
  const write = buildDistributorImportWrite({
    ...updateRow,
    status: "new",
    matchReason: null,
    matchedDistributorId: null,
    matchedDistributorName: null,
  }, "distributor-new");

  assert.equal(write.id, "distributor-new");
  assert.equal(DISTRIBUTOR_DATA_MIGRATION_TRANSACTION_OPTIONS.isolationLevel, "Serializable");
  assert.ok((DISTRIBUTOR_DATA_MIGRATION_TRANSACTION_OPTIONS.timeout ?? 0) >= 60_000);
});
