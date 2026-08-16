import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/Button";
import { tauri } from "../../services/tauri";
import type { BatchCommandRequest } from "../../services/tauri";
import { buildManifestInput, isSigningConfigured } from "../../services/c2pa";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";

export function BatchSourcePanel() {
  const batchInputDir = useVeraMarkStore((state) => state.batchInputDir);
  const batchOutputDir = useVeraMarkStore((state) => state.batchOutputDir);
  const batchRunning = useVeraMarkStore((state) => state.batchRunning);
  const batchImages = useVeraMarkStore((state) => state.batchImages);

  async function pickInputDir() {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Select input directory",
    });
    if (typeof dir !== "string") return;
    const store = useVeraMarkStore.getState();
    store.setBatchInputDir(dir);
    try {
      const files = await tauri.listBatchImages(dir);
      const previews = [];
      for (const file of files.slice(0, 12)) {
        try {
          previews.push(await tauri.previewImage(file.path, 320));
        } catch {
          // Skip non-renderable thumbnails.
        }
      }
      store.setBatchImages(previews);
      store.setLastError(null);
    } catch (error) {
      store.setLastError(String(error));
    }
  }

  async function pickOutputDir() {
    const dir = await open({
      directory: true,
      multiple: false,
      title: "Select output directory",
    });
    if (typeof dir === "string") {
      useVeraMarkStore.getState().setBatchOutputDir(dir);
    }
  }

  async function runBatch() {
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

    const request: BatchCommandRequest = {
      inputDir: store.batchInputDir,
      outputDir: store.batchOutputDir,
      labelId: store.selectedLabelId,
      transform: store.transform,
      format: store.format,
      jpegQuality: store.jpegQuality,
      c2pa: manifest,
    };

    store.setBatchRunning(true);
    store.setProgress(null);
    store.setLastError(null);
    store.setLastMessage(`Batching images…`);
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

  const disabled = batchRunning;

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={disabled} onClick={() => void pickInputDir()}>
        {batchInputDir ? "Change input dir…" : "Choose input dir…"}
      </Button>
      <Button className="w-full" disabled={disabled} onClick={() => void pickOutputDir()}>
        {batchOutputDir ? "Change output dir…" : "Choose output dir…"}
      </Button>
      <div className="text-xs text-zinc-500">
        <span className="block truncate" title={batchInputDir ?? undefined}>
          In: {batchInputDir ?? "—"}
        </span>
        <span className="block truncate" title={batchOutputDir ?? undefined}>
          Out: {batchOutputDir ?? "—"}
        </span>
        <span className="block">{batchImages.length} images previewed</span>
      </div>
      <Button
        variant="primary"
        className="w-full"
        disabled={disabled || !batchInputDir || !batchOutputDir}
        onClick={() => void runBatch()}
      >
        {disabled ? "Processing…" : "Export all"}
      </Button>
    </div>
  );
}