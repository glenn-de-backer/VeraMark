import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { BatchGallery } from "./BatchGallery";
import { OverlayCanvas } from "./OverlayCanvas";
import type { ManifestReadResult } from "../../models/c2pa";
import { useImageActions } from "../../hooks/useImageActions";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";

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
  const singleImagePath = useVeraMarkStore((state) => state.singleImagePath);
  const openManifest = useVeraMarkStore((state) => state.openManifest);
  const batchFiles = useVeraMarkStore((state) => state.batchFiles);
  const labels = useVeraMarkStore((state) => state.labels);
  const selectedLabelId = useVeraMarkStore((state) => state.selectedLabelId);
  const transform = useVeraMarkStore((state) => state.transform);
  const batchRunning = useVeraMarkStore((state) => state.batchRunning);
  const progress = useVeraMarkStore((state) => state.progress);
  const lastMessage = useVeraMarkStore((state) => state.lastMessage);
  const lastError = useVeraMarkStore((state) => state.lastError);
  const imageLoading = useVeraMarkStore((state) => state.imageLoading);
  const { openImage, pickBatchInput } = useImageActions();

  const selectedLabel = labels.find((label) => label.id === selectedLabelId) ?? null;
  const labelSrc = selectedLabel?.dataUrl ?? null;

  return (
    <div className="relative flex h-full flex-col">
      {imageLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-zinc-950/50 backdrop-blur-[2px]">
          <Spinner className="h-9 w-9" />
          <span className="text-xs font-medium text-zinc-300">Loading…</span>
        </div>
      )}
      {batchRunning && (
        <div className="absolute inset-x-0 top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-4 py-2 backdrop-blur">
          {progress ? (
            <div className="flex items-center gap-3">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-700">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{
                    width: `${Math.round(
                      (progress.done / Math.max(progress.total, 1)) * 100,
                    )}%`,
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
            <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] text-zinc-400">
              {lastError ? (
                <span
                  className="min-w-0 truncate text-red-300"
                  title={lastError}
                >
                  {lastError}
                </span>
              ) : lastMessage ? (
                <span className="min-w-0 truncate text-sky-300">
                  {lastMessage}
                </span>
              ) : (
                <span className="min-w-0 truncate font-mono">
                  {fileBaseLabel(singleImagePath)}
                </span>
              )}
              <span
                className="ml-auto min-w-0 truncate"
                title={manifestReadout(openManifest)}
              >
                {manifestReadout(openManifest)}
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
      ) : batchFiles.length > 0 ? (
        <BatchGallery
          files={batchFiles}
          labelSrc={labelSrc}
          transform={transform}
        />
      ) : (
        <EmptyState
          title="Select a batch directory"
          hint="Choose an input directory to preview its images here."
          actionLabel="Choose input directory"
          onAction={() => void pickBatchInput()}
        />
      )}

      {mode === "batch" && (lastMessage || lastError) && (
        <div
          className={`border-t px-3 py-1.5 text-[11px] ${
            lastError
              ? "border-red-900 bg-red-950/60 text-red-300"
              : "border-zinc-800 bg-zinc-900/80 text-zinc-300"
          }`}
        >
          <span className="block truncate">{lastError ?? lastMessage}</span>
        </div>
      )}
    </div>
  );
}

function manifestReadout(manifest: ManifestReadResult | null): string {
  if (!manifest) return "No manifest";
  const title = manifest.title ?? "(untitled)";
  const generator = manifest.claimGenerator ? ` · ${manifest.claimGenerator}` : "";
  const signature =
    manifest.signatureValid === true
      ? "sig valid"
      : manifest.signatureValid === false
        ? "sig invalid"
        : "sig unverified";
  return `Manifest “${title}”${generator} · ${signature}`;
}

function fileBaseLabel(path: string | null): string {
  if (!path) return "";
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}
