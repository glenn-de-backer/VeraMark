import { create } from "zustand";
import type { LabelAsset, TransformConfig } from "../models/label";
import type {
  BatchProgress,
  C2paSettings,
  ExportFormat,
  ManifestReadResult,
} from "../models/c2pa";
import type { ImageFileInfo, PreviewImage } from "../models/image";
import { DEFAULT_C2PA } from "../models/c2pa";
import { DEFAULT_TRANSFORM } from "../models/label";

export type ProcessingMode = "single" | "batch";

interface VeraMarkState {
  // Mode
  mode: ProcessingMode;
  setMode: (mode: ProcessingMode) => void;

  // Label catalog
  labels: LabelAsset[];
  labelsDirectory: string | null;
  labelsLoading: boolean;
  labelsErrors: string[];
  setLabels: (labels: LabelAsset[], directory: string, errors: string[]) => void;
  setLabelsLoading: (loading: boolean) => void;

  // Selection + transform
  selectedLabelId: string;
  transform: TransformConfig;
  setSelectedLabelId: (id: string) => void;
  setTransform: (partial: Partial<TransformConfig>) => void;

  // Export / C2PA settings
  c2pa: C2paSettings;
  format: ExportFormat;
  jpegQuality: number;
  setC2pa: (partial: Partial<C2paSettings>) => void;
  setFormat: (format: ExportFormat) => void;
  setJpegQuality: (quality: number) => void;

  // Single mode
  singleImage: PreviewImage | null;
  singleImagePath: string | null;
  setSingleImage: (image: PreviewImage | null, path: string | null) => void;

  // C2PA manifest of the currently open single image (read on open/export).
  openManifest: ManifestReadResult | null;
  setOpenManifest: (manifest: ManifestReadResult | null) => void;

  // Batch mode
  batchInputDir: string | null;
  batchOutputDir: string | null;
  /**
   * Metadata (path + dimensions) for every image in the input directory. The
   * virtualized gallery fetches thumbnails lazily for only the visible tiles,
   * so this stays memory-cheap regardless of directory size.
   */
  batchFiles: ImageFileInfo[];
  setBatchInputDir: (dir: string | null) => void;
  setBatchOutputDir: (dir: string | null) => void;
  setBatchFiles: (files: ImageFileInfo[]) => void;

  /**
   * File paths to EXCLUDE from batch export. Empty set = include every image
   * in the input directory (the default when a directory is first loaded).
   * Selected count = total minus the size of this set.
   */
  deselectedBatchPaths: Set<string>;
  toggleBatchSelection: (path: string) => void;
  selectAllBatch: () => void;
  selectNoneBatch: () => void;

  // Progress & status
  progress: BatchProgress | null;
  batchRunning: boolean;
  lastMessage: string | null;
  lastError: string | null;
  /** True while a preview/thumbnail batch is being produced by the backend. */
  imageLoading: boolean;
  setProgress: (progress: BatchProgress | null) => void;
  setBatchRunning: (running: boolean) => void;
  setLastMessage: (message: string | null) => void;
  setLastError: (error: string | null) => void;
  setImageLoading: (loading: boolean) => void;
}

export const useVeraMarkStore = create<VeraMarkState>((set) => ({
  mode: "single",
  setMode: (mode) => set({ mode }),

  labels: [],
  labelsDirectory: null,
  labelsLoading: false,
  labelsErrors: [],
  setLabels: (labels, directory, errors) =>
    set({ labels, labelsDirectory: directory, labelsErrors: errors }),
  setLabelsLoading: (labelsLoading) => set({ labelsLoading }),

  selectedLabelId: "",
  transform: { ...DEFAULT_TRANSFORM },
  setSelectedLabelId: (selectedLabelId) => set({ selectedLabelId }),
  setTransform: (partial) =>
    set((state) => ({
      transform: {
        ...state.transform,
        ...partial,
        // Offsets are non-negative pixel magnitudes; defensively clamp so no
        // caller can ever store a negative value.
        offsetX: Math.max(
          0,
          Math.round(partial.offsetX ?? state.transform.offsetX),
        ),
        offsetY: Math.max(
          0,
          Math.round(partial.offsetY ?? state.transform.offsetY),
        ),
      },
    })),

  c2pa: { ...DEFAULT_C2PA },
  format: "jpeg",
  jpegQuality: 92,
  setC2pa: (partial) =>
    set((state) => ({ c2pa: { ...state.c2pa, ...partial } })),
  setFormat: (format) => set({ format }),
  setJpegQuality: (jpegQuality) => set({ jpegQuality }),

  singleImage: null,
  singleImagePath: null,
  setSingleImage: (singleImage, singleImagePath) =>
    set({ singleImage, singleImagePath }),

  openManifest: null,
  setOpenManifest: (openManifest) => set({ openManifest }),

  batchInputDir: null,
  batchOutputDir: null,
  batchFiles: [],
  setBatchInputDir: (batchInputDir) => set({ batchInputDir }),
  setBatchOutputDir: (batchOutputDir) => set({ batchOutputDir }),
  setBatchFiles: (batchFiles) => set({ batchFiles }),

  deselectedBatchPaths: new Set<string>(),
  toggleBatchSelection: (path) =>
    set((state) => {
      const next = new Set(state.deselectedBatchPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { deselectedBatchPaths: next };
    }),
  selectAllBatch: () => set({ deselectedBatchPaths: new Set<string>() }),
  selectNoneBatch: () =>
    set((state) => ({
      deselectedBatchPaths: new Set(state.batchFiles.map((file) => file.path)),
    })),

  progress: null,
  batchRunning: false,
  lastMessage: null,
  lastError: null,
  imageLoading: false,
  setProgress: (progress) => set({ progress }),
  setBatchRunning: (batchRunning) => set({ batchRunning }),
  setLastMessage: (lastMessage) => set({ lastMessage }),
  setLastError: (lastError) => set({ lastError }),
  setImageLoading: (imageLoading) => set({ imageLoading }),
}));