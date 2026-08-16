import { open, save } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/Button";
import { tauri } from "../../services/tauri";
import type { ExportCommandRequest } from "../../services/tauri";
import { buildManifestInput, isSigningConfigured } from "../../services/c2pa";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";
import { defaultOutputPath, fileName } from "../../utils/paths";
import { IMAGE_FILTERS } from "../../constants/files";

export function SingleSourcePanel() {
  const singleImagePath = useVeraMarkStore((state) => state.singleImagePath);

  async function pickImage() {
    const path = await open({
      multiple: false,
      filters: IMAGE_FILTERS,
      title: "Select an image",
    });
    if (typeof path !== "string") return;
    try {
      const preview = await tauri.previewImage(path, 1920);
      const store = useVeraMarkStore.getState();
      store.setSingleImage(preview, path);
      store.setLastError(null);
    } catch (error) {
      useVeraMarkStore.getState().setLastError(String(error));
    }
  }

  async function exportSingle() {
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

  return (
    <div className="space-y-3">
      <Button variant="primary" className="w-full" onClick={() => void pickImage()}>
        {singleImagePath ? "Change image…" : "Open image…"}
      </Button>
      <Button
        className="w-full"
        disabled={!singleImagePath}
        onClick={() => void exportSingle()}
      >
        Export image…
      </Button>
    </div>
  );
}