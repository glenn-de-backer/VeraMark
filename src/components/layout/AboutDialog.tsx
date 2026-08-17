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
          <p className="text-xs font-medium text-zinc-400">
            Made by Glenn De Backer
          </p>

          <p>
            VeraMark lets you mark, certify, and prove the origin of
            AI-generated or edited images. It overlays visible, standardized
            AI-attribution labels on your images and embeds secure,
            cryptographically signed C2PA content credentials — for a single
            image or an entire directory at once.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className="text-zinc-500">Find VeraMark online:</span>
            <a
              href="http://www.glenndebacker.be"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline-offset-2 hover:underline"
            >
              www.glenndebacker.be
            </a>
            <a
              href="https://github.com/glenn-de-backer/VeraMark"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline-offset-2 hover:underline"
            >
              GitHub
            </a>
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