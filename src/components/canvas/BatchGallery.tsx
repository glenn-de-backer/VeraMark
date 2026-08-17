import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ImageFileInfo, PreviewImage } from "../../models/image";
import type { TransformConfig } from "../../models/label";
import { tauri } from "../../services/tauri";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";
import { Spinner } from "../ui/Spinner";
import { BatchPreviewModal } from "./BatchPreviewModal";
import { OverlayCanvas } from "./OverlayCanvas";

/**
 * Virtualized, lazy-loading gallery for batch mode. Every image in the input
 * directory is represented (metadata only lives in the store), but only the
 * tiles inside the current scroll window (+ overscan) are mounted, and each
 * mounted tile fetches its 320px thumbnail on demand. This keeps DOM node
 * count and decoded-image memory bounded no matter the directory size.
 */

/** Fixed tile geometry — must stay synced with `h-44` and `gap-3`. */
const TILE_HEIGHT = 176;
const TILE_GAP = 12;
const ROW_HEIGHT = TILE_HEIGHT + TILE_GAP;
const MIN_TILE_WIDTH = 200;
/** Rows mounted above/below the viewport to avoid blank flashes while scrolling. */
const OVERSCAN_ROWS = 2;

/** LRU cache of lazily generated thumbnails (bounded memory). */
const THUMB_CACHE = new Map<string, PreviewImage>();
const THUMB_CACHE_MAX = 256;
/** Dedupes concurrent thumbnail requests for the same file. */
const THUMB_INFLIGHT = new Map<string, Promise<PreviewImage | null>>();

function thumbFor(file: ImageFileInfo): Promise<PreviewImage | null> {
  const cached = THUMB_CACHE.get(file.path);
  if (cached) return Promise.resolve(cached);

  const inFlight = THUMB_INFLIGHT.get(file.path);
  if (inFlight) return inFlight;

  const promise = tauri
    .previewImage(file.path, 320)
    .then((preview) => {
      if (THUMB_CACHE.size >= THUMB_CACHE_MAX) {
        // Evict the least-recently-inserted entry to keep memory bounded.
        const oldest = THUMB_CACHE.keys().next();
        if (!oldest.done) THUMB_CACHE.delete(oldest.value);
      }
      THUMB_CACHE.set(file.path, preview);
      return preview;
    })
    .catch(() => null);

  THUMB_INFLIGHT.set(file.path, promise);
  void promise.finally(() => {
    THUMB_INFLIGHT.delete(file.path);
  });
  return promise;
}

interface BatchGalleryProps {
  files: ImageFileInfo[];
  labelSrc: string | null;
  transform: TransformConfig;
}

export function BatchGallery({ files, labelSrc, transform }: BatchGalleryProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    scrollTop: 0,
  });

  // Measure the scroll container and re-measure on resize.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const recompute = () =>
      setViewport({
        width: el.clientWidth,
        height: el.clientHeight,
        scrollTop: el.scrollTop,
      });
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // New directory → jump back to the top and re-derive the window.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setViewport((value) => ({ ...value, scrollTop: 0 }));
    // Only reset when the directory contents change, not on every scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const columns = Math.max(
    1,
    Math.floor((viewport.width + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP)),
  );
  const totalRows = Math.ceil(files.length / Math.max(1, columns));
  const totalHeight = totalRows > 0 ? totalRows * ROW_HEIGHT - TILE_GAP : 0;

  const startRow = Math.max(
    0,
    Math.floor(viewport.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  );
  const endRow = Math.min(
    totalRows,
    Math.ceil((viewport.scrollTop + viewport.height) / ROW_HEIGHT) +
      OVERSCAN_ROWS,
  );
  const startIndex = Math.min(startRow * columns, files.length);
  const endIndex = Math.min(files.length, endRow * columns);
  const visible = files.slice(startIndex, endIndex);

  // Batch selection lives in the store; empty exclusion set = all selected.
  const deselectedBatchPaths = useVeraMarkStore(
    (state) => state.deselectedBatchPaths,
  );
  const toggleBatchSelection = useVeraMarkStore(
    (state) => state.toggleBatchSelection,
  );
  const selectAllBatch = useVeraMarkStore((state) => state.selectAllBatch);
  const selectNoneBatch = useVeraMarkStore((state) => state.selectNoneBatch);
  const batchRunning = useVeraMarkStore((state) => state.batchRunning);
  const selectedCount = files.reduce(
    (count, file) => count + (deselectedBatchPaths.has(file.path) ? 0 : 1),
    0,
  );
  const [openPreviewPath, setOpenPreviewPath] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] text-zinc-500">
        <span>
          {files.length} {files.length === 1 ? "image" : "images"}
        </span>
        <span
          className={`font-mono ${
            selectedCount === 0 ? "text-amber-300" : "text-zinc-400"
          }`}
        >
          {selectedCount} selected
        </span>
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          disabled={batchRunning || selectedCount === files.length}
          onClick={selectAllBatch}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Select all
        </button>
        <button
          type="button"
          disabled={batchRunning || selectedCount === 0}
          onClick={selectNoneBatch}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Select none
        </button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4"
        onScroll={() => {
          const el = scrollRef.current;
          if (el) setViewport((value) => ({ ...value, scrollTop: el.scrollTop }));
        }}
      >
        <div className="relative" style={{ height: totalHeight }}>
          <div
            className="absolute left-0 right-0 grid gap-3"
            style={{
              top: startRow * ROW_HEIGHT,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {visible.map((file) => {
              const selected = !deselectedBatchPaths.has(file.path);
              return (
                <GalleryTile
                  key={file.path}
                  file={file}
                  labelSrc={labelSrc}
                  transform={transform}
                  selected={selected}
                  disabled={batchRunning}
                  onToggle={() => toggleBatchSelection(file.path)}
                  onOpen={() => setOpenPreviewPath(file.path)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {openPreviewPath && (
        <BatchPreviewModal
          files={files}
          openPath={openPreviewPath}
          labelSrc={labelSrc}
          transform={transform}
          onClose={() => setOpenPreviewPath(null)}
          onNavigate={setOpenPreviewPath}
        />
      )}
    </div>
  );
}

function GalleryTile({
  file,
  labelSrc,
  transform,
  selected,
  disabled,
  onToggle,
  onOpen,
}: {
  file: ImageFileInfo;
  labelSrc: string | null;
  transform: TransformConfig;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const [preview, setPreview] = useState<PreviewImage | null | undefined>(
    THUMB_CACHE.get(file.path),
  );

  useEffect(() => {
    let cancelled = false;
    setPreview(THUMB_CACHE.get(file.path));
    void thumbFor(file).then((thumb) => {
      if (!cancelled) setPreview(thumb);
    });
    return () => {
      cancelled = true;
    };
  }, [file.path]);

  return (
    <div
      title={file.name}
      className={`relative h-44 overflow-hidden rounded-lg border bg-zinc-900 transition-colors ${
        selected
          ? "border-zinc-700"
          : "border-zinc-800 opacity-70"
      }`}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {preview === undefined ? (
            <Spinner className="h-5 w-5" />
          ) : (
            <p className="px-2 text-center text-[11px] text-zinc-600">
              No preview
            </p>
          )}
        </div>
      )}

      {/* Full-preview click target (over the image, below the checkbox). */}
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={`Preview ${file.name}`}
        title="Click to preview full size"
        className="absolute inset-0 cursor-zoom-in disabled:cursor-not-allowed"
      />

      {/* Selection checkbox overlay. */}
      <label
        className="absolute left-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="relative flex h-5 w-5 items-center justify-center rounded border border-zinc-500 bg-zinc-950/70">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={onToggle}
            aria-label={selected ? `Deselect ${file.name}` : `Select ${file.name}`}
            title={selected ? "Deselect (exclude from batch)" : "Select (include in batch)"}
            className="peer h-4 w-4 cursor-pointer appearance-none rounded-sm border border-zinc-500 bg-zinc-800 checked:border-sky-500 checked:bg-sky-600 disabled:cursor-not-allowed"
          />
          <svg
            viewBox="0 0 16 16"
            className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </label>

      <span className="pointer-events-none absolute right-2 top-2 rounded bg-zinc-950/55 p-1 text-zinc-400">
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      </span>

      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-zinc-950/80 to-transparent px-2 pb-1 pt-4 text-[10px] text-zinc-300">
        {file.name}
      </span>
    </div>
  );
}