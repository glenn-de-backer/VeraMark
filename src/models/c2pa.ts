export interface C2paSettings {
  enabled: boolean;
  claimGeneratorName: string;
  claimGeneratorVersion: string;
  producerTrainedOnData: boolean;
  /** Path to a PEM-encoded private key (optional dev/testing signing). */
  signerKeyPath: string;
  /** Path to a PEM-encoded signing certificate (optional dev/testing signing). */
  signerCertPath: string;
}

export type ExportFormat = "png" | "jpeg";

export interface ExportResult {
  outputPath: string;
  format: ExportFormat;
  width: number;
  height: number;
  bytesWritten: number;
  manifestLabel: string | null;
  manifestSigned: boolean;
}

export interface BatchProgress {
  done: number;
  total: number;
  current: string;
}

export interface BatchResult {
  processed: number;
  failed: number;
  outputs: string[];
  errors: string[];
}

export interface ManifestReadResult {
  title: string | null;
  format: string | null;
  claimGenerator: string | null;
  signatureValid: boolean | null;
  labels: string[];
}

export const DEFAULT_C2PA: C2paSettings = {
  /** C2PA embedding is opt-in — off until the user enables it and signs. */
  enabled: false,
  claimGeneratorName: "VeraMark",
  claimGeneratorVersion: "0.1.0",
  producerTrainedOnData: false,
  signerKeyPath: "",
  signerCertPath: "",
};