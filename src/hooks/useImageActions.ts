import { open, save } from "@tauri-apps/plugin-dialog";
import { IMAGE_FILTERS } from "../constants/files";
import { buildManifestInput, isSigningConfigured } from "../services/c2pa";
import {
  tauri,
  type BatchCommandRequest,
  type ExportCommandRequest,
} from "../services/tauri";
import { useVeraMarkStore } from "../stores/useVeraMarkStore";
import { defaultOutputPath, fileName } from "../utils/paths";

/**
 * Centralized single-image / batch actions shared by the top header and the
 * canvas empty states. Keeps open/export/batch orchestration in one place so
 * the UI never has to duplicate dialog + IPC + error handling.
 */
export function useImageActions() {
  /** Opens a single image, loads its preview, and reads any C2PA manifest. */
  async function openImage(): Promise<void> {
    const path = await open({
      multiple: false,
      filters: IMAGE_FILTERS,
      title: "Select an image",
    });
    if (typeof path !== "string") return;

    const store = useVeraMarkStore.getState();
    store.setLastError(null);
    store.setImageLoading(true);
    try {
      const preview = await tauri.previewImage(path, 1920);
      store.setSingleImage(preview, path);
      try {
        store.setOpenManifest(await tauri.readManifest(path));
      } catch {
        store.setOpenManifest(null);
      }
    } catch (error) {
      store.setLastError(String(error));
    } finally {
      store.setImageLoading(false);
    }
  }

  /** Exports the open single image (with save dialog + C2PA signing guard). */
  async function exportSingle(): Promise<void> {
    const store = useVeraMarkStore.getState();
    const inputPath = store.singleImagePath;
    if (!inputPath) {
      store.setLastError("Open an image before exporting.");
      return;
    }

    const manifest = buildManifestInput(store.c2pa);
    if (manifest.enabled && !isSigningConfigured(manifest)) {
      store.setLastError(
        "C2PA is enabled but no signing key/certificate is configured. " +
          "Provide a PEM key + certificate in the Provenance panel (or disable C2PA).",
      );
      return;
    }

    const outputPath = await save({
      title: "Export image",
      defaultPath: defaultOutputPath(inputPath, store.format),
      filters: [{ name: "Images", extensions: [store.format] }],
    });
    if (typeof outputPath !== "string") return;

    const request: ExportCommandRequest = {
      inputPath,
      outputPath,
      labelId: store.selectedLabelId,
      transform: store.transform,
      format: store.format,
      jpegQuality: store.jpegQuality,
      c2pa: manifest,
    };

    store.setLastMessage("Exporting…");
    store.setLastError(null);
    try {
      const result = await tauri.processAndExport(request);
      const tail = result.manifestLabel
        ? ` · manifest “${result.manifestLabel}” ${
            result.manifestSigned ? "signed" : "unsigned"
          }`
        : " · no C2PA manifest";
      store.setLastMessage(
        `${fileName(outputPath)} exported (${result.bytesWritten} bytes, ` +
          `${result.width}×${result.height}${tail}).`,
      );
    } catch (error) {
      store.setLastError(String(error));
    }
  }
/** Pick the batch input directory. Thumbnails are generated lazily by the
 * virtualized gallery only for tiles that scroll into view, so selecting a
 * directory just records lightweight metadata and returns immediately. */
  async function pickBatchInput(): Promise<void> {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Select input directory",
    });
    if (typeof dir !== "string") return;

    const store = useVeraMarkStore.getState();
    store.setBatchInputDir(dir);
    store.setImageLoading(true);
    try {
      store.setBatchFiles(await tauri.listBatchImages(dir));
      // A fresh directory → start with every image selected (empty exclusions).
      store.selectAllBatch();
      store.setLastError(null);
    } catch (error) {
      store.setLastError(String(error));
    } finally {
      store.setImageLoading(false);
    }
  }

  /** Pick the batch output directory. */
  async function pickBatchOutput(): Promise<void> {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Select output directory",
    });
    if (typeof dir === "string") {
      useVeraMarkStore.getState().setBatchOutputDir(dir);
    }
  }

  /** Run the batch export pipeline for every image in the input directory. */
  async function runBatch(): Promise<void> {
    const store = useVeraMarkStore.getState();
    if (!store.batchInputDir) {
      store.setLastError("Choose an input directory first.");
      return;
    }
    if (!store.batchOutputDir) {
      store.setLastError("Choose an output directory first.");
      return;
    }

    const manifest = buildManifestInput(store.c2pa);
    if (manifest.enabled && !isSigningConfigured(manifest)) {
      store.setLastError(
        "C2PA is enabled but no signing key/certificate is configured. " +
          "Set a PEM key + certificate (or disable C2PA) before running the batch.",
      );
      return;
    }

    // Batch processes exactly the user-selected images (empty exclusions = all).
    const filesToProcess = store.batchFiles
      .filter((file) => !store.deselectedBatchPaths.has(file.path))
      .map((file) => file.path);
    if (filesToProcess.length === 0) {
      store.setLastError(
        "No images are selected — select at least one image before exporting.",
      );
      return;
    }

    const request: BatchCommandRequest = {
      inputDir: store.batchInputDir,
      outputDir: store.batchOutputDir,
      files: filesToProcess,
      labelId: store.selectedLabelId,
      transform: store.transform,
      format: store.format,
      jpegQuality: store.jpegQuality,
      c2pa: manifest,
    };

    store.setBatchRunning(true);
    store.setProgress(null);
    store.setLastError(null);
    store.setLastMessage("Batching images…");
    try {
      const result = await tauri.processBatchDirectory(request);
      store.setLastMessage(
        `Batch complete: ${result.processed} processed, ${result.failed} failed.`,
      );
      if (result.errors.length > 0) {
        const first = result.errors[0];
        const more =
          result.errors.length > 1
            ? ` (+${result.errors.length - 1} more)`
            : "";
        store.setLastError(`Batch errors: ${first}${more}`);
      }
    } catch (error) {
      store.setLastError(String(error));
    } finally {
      store.setBatchRunning(false);
      store.setProgress(null);
    }
  }

  return { openImage, exportSingle, pickBatchInput, pickBatchOutput, runBatch };
}