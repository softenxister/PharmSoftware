import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

export const OUTBOUND_ADDRESS_ATTEMPT_TIMEOUT_MS = 2_000;

export function configureOutboundNetworkDefaults(): void {
  setDefaultAutoSelectFamilyAttemptTimeout(OUTBOUND_ADDRESS_ATTEMPT_TIMEOUT_MS);
}
