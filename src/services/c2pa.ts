import type { C2paSettings } from "../models/c2pa";

/**
 * C2paManifestAdapter — bridges UI-level provenance settings into the exact
 * manifest request the Rust backend expects (matching `C2paSettings`).
 * Normalizes inputs and enforces invariants before IPC.
 */
export interface ManifestInput {
  enabled: boolean;
  claimGeneratorName: string;
  claimGeneratorVersion: string;
  producerTrainedOnData: boolean;
  signerKeyPath: string;
  signerCertPath: string;
}

export function buildManifestInput(settings: C2paSettings): ManifestInput {
  return {
    enabled: settings.enabled,
    claimGeneratorName: settings.claimGeneratorName.trim() || "VeraMark",
    claimGeneratorVersion: settings.claimGeneratorVersion.trim() || "0.1.0",
    producerTrainedOnData: settings.producerTrainedOnData,
    signerKeyPath: settings.signerKeyPath.trim(),
    signerCertPath: settings.signerCertPath.trim(),
  };
}

/** True when signing is configured but was not — surface a clear error early. */
export function isSigningConfigured(input: ManifestInput): boolean {
  return input.signerKeyPath.length > 0 && input.signerCertPath.length > 0;
}