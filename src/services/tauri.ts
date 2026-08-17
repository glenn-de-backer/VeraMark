import { invoke } from "@tauri-apps/api/core";
import type { LabelAsset, TransformConfig } from "../models/label";
import type {
  BatchResult,
  C2paSettings,
  ExportFormat,
  ExportResult,
  ManifestReadResult,
} from "../models/c2pa";
import type { ImageFileInfo, PreviewImage } from "../models/image";

/**
 * Typed Tauri IPC bridge. Argument / payload shapes here must match the Rust
 * command structs (serde `rename_all = "camelCase"` on every field).
 */

export interface LoadLabelsResult {
  labels: LabelAsset[];
  directory: string;
  errors: string[];
}

export interface SignerStatusResult {
  configured: boolean;
  valid: boolean;
  error: string | null;
}

/** Mirrors `src-tauri/src/commands/settings.rs::SettingsFile`. */
export interface SettingsFile {
  c2pa: C2paSettings;
  format: ExportFormat;
  jpegQuality: number;
}

export interface ExportCommandRequest {
  inputPath: string;
  outputPath: string;
  labelId: string;
  transform: TransformConfig;
  format: ExportFormat;
  jpegQuality: number;
  c2pa: C2paSettings;
}

export interface BatchCommandRequest {
  inputDir: string;
  outputDir: string;
  /** Exact image paths to process; empty means "process the whole directory". */
  files: string[];
  labelId: string;
  transform: TransformConfig;
  format: ExportFormat;
  jpegQuality: number;
  c2pa: C2paSettings;
}

/** Tauri progress events emitted by the Rust backend. */
export const BATCH_PROGRESS_EVENT = "batch-progress";
export const BATCH_COMPLETE_EVENT = "batch-complete";
export const LABELS_CHANGED_EVENT = "labels-changed";

export const tauri = {
  loadLabels: (): Promise<LoadLabelsResult> => invoke<LoadLabelsResult>("load_labels"),

  refreshLabels: (): Promise<LoadLabelsResult> =>
    invoke<LoadLabelsResult>("refresh_labels"),

  previewImage: (path: string, maxDim: number): Promise<PreviewImage> =>
    invoke<PreviewImage>("preview_image", { request: { path, maxDim } }),

  processAndExport: (request: ExportCommandRequest): Promise<ExportResult> =>
    invoke<ExportResult>("process_and_export", { request }),

  listBatchImages: (inputDir: string): Promise<ImageFileInfo[]> =>
    invoke<ImageFileInfo[]>("list_batch_images", { inputDir }),

  processBatchDirectory: (request: BatchCommandRequest): Promise<BatchResult> =>
    invoke<BatchResult>("process_batch_directory", { request }),

  readManifest: (path: string): Promise<ManifestReadResult | null> =>
    invoke<ManifestReadResult | null>("read_manifest", { path }),

  validateSigner: (
    keyPath: string,
    certPath: string,
  ): Promise<SignerStatusResult> =>
    invoke<SignerStatusResult>("validate_signer", { keyPath, certPath }),

  loadSettings: (): Promise<SettingsFile> =>
    invoke<SettingsFile>("load_settings"),

  saveSettings: (settings: SettingsFile): Promise<null> =>
    invoke<null>("save_settings", { settings }),

  watchLabels: (): Promise<null> => invoke<null>("watch_labels"),
};