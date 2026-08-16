import { create } from "zustand";
import type { LabelAsset, TransformConfig } from "../models/label";
import type {
  BatchProgress,
  C2paSettings,
  ExportFormat,
} from "../models/c2pa";
import type { PreviewImage } from "../models/image";
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

  // Batch mode
  batchInputDir: string | null;
  batchOutputDir: string | null;
  batchImages: PreviewImage[];
  setBatchInputDir: (dir: string | null) => void;
  setBatchOutputDir: (dir: string | null) => void;
  setBatchImages: (images: PreviewImage[]) => void;

  // Progress & status
  progress: BatchProgress | null;
  batchRunning: boolean;
  lastMessage: string | null;
  lastError: string | null;
  setProgress: (progress: BatchProgress | null) => void;
  setBatchRunning: (running: boolean) => void;
  setLastMessage: (message: string | null) => void;
  setLastError: (error: string | null) => void;
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
    set((state) => ({ transform: { ...state.transform, ...partial } })),

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

  batchInputDir: null,
  batchOutputDir: null,
  batchImages: [],
  setBatchInputDir: (batchInputDir) => set({ batchInputDir }),
  setBatchOutputDir: (batchOutputDir) => set({ batchOutputDir }),
  setBatchImages: (batchImages) => set({ batchImages }),

  progress: null,
  batchRunning: false,
  lastMessage: null,
  lastError: null,
  setProgress: (progress) => set({ progress }),
  setBatchRunning: (batchRunning) => set({ batchRunning }),
  setLastMessage: (lastMessage) => set({ lastMessage }),
  setLastError: (lastError) => set({ lastError }),
}));