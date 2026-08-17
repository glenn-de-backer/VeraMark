import { useEffect } from "react";
import { Button } from "../ui/Button";
import { VeraMarkIcon } from "../ui/VeraMarkIcon";

const APP_VERSION = "0.1.0";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Modal "About" screen: project overview, features, and stack info. */
export function AboutDialog({ open, onClose }: AboutDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="About VeraMark"
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
          <VeraMarkIcon />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-100">About VeraMark</h2>
            <p className="text-xs text-zinc-500">Version {APP_VERSION}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
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

        <div className="space-y-4 px-5 py-4 text-sm text-zinc-300">
          <p>
            VeraMark overlays configurable AI-attribution labels on your images
            and embeds cryptographically signed{" "}
            <a
              href="https://c2pa.org"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline-offset-2 hover:underline"
            >
              C2PA&nbsp;/&nbsp;CAI
            </a>{" "}
            provenance manifests — for a single image or an entire directory at
            once.
          </p>

          <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-400">
            <li>Split-pane canvas with real-time label placement feedback</li>
            <li>Signed C2PA manifests — never an unsigned claim</li>
            <li>Parallel batch export with live progress reporting</li>
            <li>PNG (lossless) and JPEG (quality-controlled) output</li>
          </ul>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-xs text-zinc-500">
            <span className="mb-1 block font-medium text-zinc-400">Stack</span>
            <p>
              Tauri v2 · Rust (<code className="text-zinc-400">image</code>,{" "}
              <code className="text-zinc-400">c2pa</code>,{" "}
              <code className="text-zinc-400">rayon</code>) · React + TypeScript +
              Tailwind CSS v4
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}