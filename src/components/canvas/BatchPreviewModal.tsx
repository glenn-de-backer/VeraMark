import { useEffect, useState } from "react";
import type { ImageFileInfo, PreviewImage } from "../../models/image";
import type { TransformConfig } from "../../models/label";
import { tauri } from "../../services/tauri";
import { OverlayCanvas } from "./OverlayCanvas";

/**
 * Full-size lightbox for a batch thumbnail. Clicking a gallery tile opens it
 * here at a much higher resolution than the 320px tile thumbnail, rendered
 * through the same `OverlayCanvas` so preview == export (WYSIWYG). Supports
 * prev/next navigation across the current directory and Escape/backdrop close.
 */

/** Max dimension requested for the lightbox preview. */
const FULL_MAX_DIM = 1600;

/** LRU cache + in-flight dedupe for full-size previews (bounded memory). */
const FULL_CACHE = new Map<string, PreviewImage>();
const FULL_CACHE_MAX = 16;
const FULL_INFLIGHT = new Map<string, Promise<PreviewImage | null>>();

function fullPreview(path: string): Promise<PreviewImage | null> {
  const cached = FULL_CACHE.get(path);
  if (cached) return Promise.resolve(cached);

  const inFlight = FULL_INFLIGHT.get(path);
  if (inFlight) return inFlight;

  const promise = tauri
    .previewImage(path, FULL_MAX_DIM)
    .then((preview) => {
      if (FULL_CACHE.size >= FULL_CACHE_MAX) {
        const oldest = FULL_CACHE.keys().next();
        if (!oldest.done) FULL_CACHE.delete(oldest.value);
      }
      FULL_CACHE.set(path, preview);
      return preview;
    })
    .catch(() => null);

  FULL_INFLIGHT.set(path, promise);
  void promise.finally(() => {
    FULL_INFLIGHT.delete(path);
  });
  return promise;
}

interface BatchPreviewModalProps {
  files: ImageFileInfo[];
  openPath: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
  labelSrc: string | null;
  transform: TransformConfig;
}

export function BatchPreviewModal({
  files,
  openPath,
  onClose,
  onNavigate,
  labelSrc,
  transform,
}: BatchPreviewModalProps) {
  const index = files.findIndex((file) => file.path === openPath);
  const file = index >= 0 ? files[index] : null;
  const [preview, setPreview] = useState<PreviewImage | null | undefined>(
    FULL_CACHE.get(openPath),
  );

  useEffect(() => {
    let cancelled = false;
    setPreview(FULL_CACHE.get(openPath));
    void fullPreview(openPath).then((result) => {
      if (!cancelled) setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [openPath]);

  useEffect(() => {
    if (!file) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) {
        onNavigate(files[index - 1]!.path);
      }
      if (event.key === "ArrowRight" && index < files.length - 1) {
        onNavigate(files[index + 1]!.path);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, index, files, onClose, onNavigate]);

  if (!file) return null;

  const selectedName = (name: string) =>
    name.replace(/\.[^.]+$/, "").replace(/-marked$/, "");

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.name}`}
    >

      <div
        className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900/95 px-4 py-3"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
          {file.name}
        </h2>
        <span className="shrink-0 font-mono text-[11px] text-zinc-500">
          {file.width}×{file.height}px
        </span>
        {files.length > 1 && (
          <span className="shrink-0 font-mono text-[11px] text-zinc-500">
            {index + 1} / {files.length}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          title="Close (Esc)"
          className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {preview ? (
          <OverlayCanvas
            src={preview.dataUrl}
            labelSrc={labelSrc}
            originalWidth={preview.originalWidth}
            originalHeight={preview.originalHeight}
            transform={transform}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            {preview === undefined ? "Loading preview…" : "No preview available"}
          </div>
        )}

        {files.length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (index > 0) onNavigate(files[index - 1]!.path);
              }}
              disabled={index <= 0}
              aria-label="Previous image"
              title="Previous (←)"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md bg-zinc-900/90 p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (index < files.length - 1) onNavigate(files[index + 1]!.path);
              }}
              disabled={index >= files.length - 1}
              aria-label="Next image"
              title="Next (→)"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-zinc-900/90 p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      <div
        className="flex shrink-0 items-center gap-2 border-t border-zinc-800 bg-zinc-900/95 px-4 py-1.5 text-[11px] text-zinc-500"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="min-w-0 truncate">
          Export name: <code className="text-zinc-400">{selectedName(file.name)}-marked</code>
        </span>
      </div>
    </div>
  );
}
