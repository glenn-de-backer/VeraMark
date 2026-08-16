import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/Button";
import { OverlayCanvas } from "./OverlayCanvas";
import { tauri } from "../../services/tauri";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";

const IMAGE_FILTERS = [
  { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif"] },
];

function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="max-w-sm">
        <h2 className="text-lg font-semibold text-zinc-200">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{hint}</p>
      </div>
      <Button variant="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function PreviewCanvas() {
  const mode = useVeraMarkStore((state) => state.mode);
  const singleImage = useVeraMarkStore((state) => state.singleImage);
  const batchImages = useVeraMarkStore((state) => state.batchImages);
  const labels = useVeraMarkStore((state) => state.labels);
  const selectedLabelId = useVeraMarkStore((state) => state.selectedLabelId);
  const transform = useVeraMarkStore((state) => state.transform);
  const batchRunning = useVeraMarkStore((state) => state.batchRunning);
  const progress = useVeraMarkStore((state) => state.progress);
  const lastMessage = useVeraMarkStore((state) => state.lastMessage);
  const lastError = useVeraMarkStore((state) => state.lastError);

  const selectedLabel = labels.find((label) => label.id === selectedLabelId) ?? null;
  const labelSrc = selectedLabel?.dataUrl ?? null;

  async function openImage() {
    const path = await open({
      multiple: false,
      filters: IMAGE_FILTERS,
      title: "Select an image",
    });
    if (typeof path !== "string") return;
    try {
      const preview = await tauri.previewImage(path, 1920);
      useVeraMarkStore.getState().setSingleImage(preview, path);
      useVeraMarkStore.getState().setLastError(null);
    } catch (error) {
      useVeraMarkStore.getState().setLastError(String(error));
    }
  }

  async function batchPickInput() {
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
          // Thumbnails that fail to render are skipped; batch reports real errors.
        }
      }
      store.setBatchImages(previews);
      store.setLastError(null);
    } catch (error) {
      store.setLastError(String(error));
    }
  }

  const gallery = mode === "batch" ? batchImages.slice(0, 12) : [];

  return (
    <div className="relative flex h-full flex-col">
      {batchRunning && (
        <div className="absolute inset-x-0 top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-4 py-2 backdrop-blur">
          {progress ? (
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="shrink-0 font-mono text-xs text-zinc-300">
                {progress.done}/{progress.total}
              </span>
              <span className="hidden max-w-48 truncate font-mono text-xs text-zinc-500 md:inline">
                {progress.current}
              </span>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Preparing batch…</p>
          )}
        </div>
      )}
{mode === "single" ? (
        singleImage ? (
          <>
            <div className="min-h-0 flex-1 p-4">
              <OverlayCanvas
                src={singleImage.dataUrl}
                labelSrc={labelSrc}
                originalWidth={singleImage.originalWidth}
                originalHeight={singleImage.originalHeight}
                transform={transform}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs text-zinc-400">
              <span className="truncate font-mono">
                {fileBaseLabel(useVeraMarkStore.getState().singleImagePath)}
              </span>
              <span className="shrink-0 font-mono">
                {singleImage.originalWidth}×{singleImage.originalHeight}px
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            title="No image selected"
            hint="Open an image to preview label placement in real time. The canvas mirrors the exported result exactly."
            actionLabel="Open image"
            onAction={() => void openImage()}
          />
        )
      ) : gallery.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {gallery.map((preview) => (
              <div
                key={preview.dataUrl}
                className="h-44 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
              >
                <OverlayCanvas
                  src={preview.dataUrl}
                  labelSrc={labelSrc}
                  originalWidth={preview.originalWidth}
                  originalHeight={preview.originalHeight}
                  transform={transform}
                />
              </div>
            ))}
          </div>
          {batchImages.length > 12 && (
            <p className="mt-3 text-center text-xs text-zinc-500">
              Previewing first 12 of {batchImages.length} images — all will be
              processed during export.
            </p>
          )}
        </div>
      ) : (
        <EmptyState
          title="Select a batch directory"
          hint="Choose an input directory in the sidebar to preview the first images here."
          actionLabel="Choose input directory"
          onAction={() => void batchPickInput()}
        />
      )}

      {(lastMessage || lastError) && (
        <div
          className={`border-t px-4 py-2 text-sm ${
            lastError
              ? "border-red-900 bg-red-950/60 text-red-300"
              : "border-zinc-800 bg-zinc-900/80 text-zinc-300"
          }`}
        >
          {lastError ?? lastMessage}
        </div>
      )}
    </div>
  );
}

function fileBaseLabel(path: string | null): string {
  if (!path) return "";
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}