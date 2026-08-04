import assert from "node:assert/strict";
import {
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import test from "node:test";
import {
  configureOutboundNetworkDefaults,
  OUTBOUND_ADDRESS_ATTEMPT_TIMEOUT_MS,
} from "./networkDefaults";

test("outbound connections allow enough time for each resolved address", () => {
  const previousTimeout = getDefaultAutoSelectFamilyAttemptTimeout();

  try {
    setDefaultAutoSelectFamilyAttemptTimeout(250);
    configureOutboundNetworkDefaults();

    assert.equal(
      getDefaultAutoSelectFamilyAttemptTimeout(),
      OUTBOUND_ADDRESS_ATTEMPT_TIMEOUT_MS,
    );
  } finally {
    setDefaultAutoSelectFamilyAttemptTimeout(previousTimeout);
  }
});
