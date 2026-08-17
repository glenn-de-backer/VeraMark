import { useState } from "react";
import { Button } from "../ui/Button";
import { VeraMarkIcon } from "../ui/VeraMarkIcon";
import { AboutDialog } from "./AboutDialog";
import { useImageActions } from "../../hooks/useImageActions";
import {
  useVeraMarkStore,
  type ProcessingMode,
} from "../../stores/useVeraMarkStore";

/**
 * Top action bar: brand, mode toggle, and per-mode file / export actions.
 * Keeps key actions pinned above the split panes without stealing panel space.
 */
export function AppHeader() {
  const mode = useVeraMarkStore((state) => state.mode);
  const batchRunning = useVeraMarkStore((state) => state.batchRunning);
  const singleImagePath = useVeraMarkStore((state) => state.singleImagePath);
  const batchInputDir = useVeraMarkStore((state) => state.batchInputDir);
  const batchOutputDir = useVeraMarkStore((state) => state.batchOutputDir);
  const { openImage, exportSingle, pickBatchInput, pickBatchOutput, runBatch } =
    useImageActions();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <VeraMarkIcon />
        <span className="text-sm font-semibold tracking-wide text-zinc-100">
          VeraMark
        </span>
      </div>

      <div className="h-6 w-px shrink-0 bg-zinc-800" />

      <ModeToggle />

      <div className="min-w-0 flex-1" />

      {mode === "single" ? (
        <>
          <Button variant="secondary" onClick={() => void openImage()}>
            {singleImagePath ? "Change image…" : "Open image…"}
          </Button>
          <Button
            variant="primary"
            disabled={!singleImagePath}
            onClick={() => void exportSingle()}
          >
            Export image…
          </Button>
        </>
      ) : (
        <>
          <div className="hidden min-w-0 items-center gap-2 font-mono text-[11px] text-zinc-500 xl:flex">
            <span className="max-w-40 truncate" title={batchInputDir ?? undefined}>
              In: {batchInputDir ?? "—"}
            </span>
            <span>·</span>
            <span className="max-w-40 truncate" title={batchOutputDir ?? undefined}>
              Out: {batchOutputDir ?? "—"}
            </span>
          </div>
          <Button
            variant="secondary"
            disabled={batchRunning}
            onClick={() => void pickBatchInput()}
          >
            {batchInputDir ? "Change input…" : "Input dir…"}
          </Button>
          <Button
            variant="secondary"
            disabled={batchRunning}
            onClick={() => void pickBatchOutput()}
          >
            {batchOutputDir ? "Change output…" : "Output dir…"}
          </Button>
          <Button
            variant="primary"
            disabled={batchRunning || !batchInputDir || !batchOutputDir}
            onClick={() => void runBatch()}
          >
            {batchRunning ? "Processing…" : "Export all"}
          </Button>
        </>
      )}

      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        title="About VeraMark"
        aria-label="About VeraMark"
        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" strokeLinecap="round" />
          <path d="M12 8h.01" strokeLinecap="round" />
        </svg>
      </button>
      </header>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}

function ModeToggle() {
  const mode = useVeraMarkStore((state) => state.mode);
  const batchRunning = useVeraMarkStore((state) => state.batchRunning);

  function setMode(next: ProcessingMode) {
    if (batchRunning) return;
    const store = useVeraMarkStore.getState();
    store.setMode(next);
    store.setLastError(null);
  }

  return (
    <div className="grid shrink-0 grid-cols-2 gap-0.5 rounded-md bg-zinc-800 p-0.5">
      {(
        [
          { value: "single", label: "Single Image" },
          { value: "batch", label: "Batch Directory" },
        ] as const
      ).map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={batchRunning}
            onClick={() => setMode(option.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-sky-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            } disabled:cursor-not-allowed`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}