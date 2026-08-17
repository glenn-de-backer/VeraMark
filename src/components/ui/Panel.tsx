import { useState } from "react";
import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  children: ReactNode;
  /** Start expanded (default true). */
  defaultOpen?: boolean;
  /** Hide the collapse toggle so the panel is always visible. */
  disableCollapse?: boolean;
  /** Reduce padding for dense sidebars. */
  compact?: boolean;
  actions?: ReactNode;
}

export function Panel({
  title,
  children,
  defaultOpen = true,
  disableCollapse = false,
  compact = false,
  actions,
}: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const collapsible = !disableCollapse;

  return (
    <section
      className={`border-b border-zinc-800 ${
        compact ? "px-3 py-3" : "px-4 py-4"
      }`}
    >
      <header className="-mx-1 flex items-center justify-between gap-2">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="group flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-zinc-800/60"
          >
            <svg
              viewBox="0 0 16 16"
              className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${
                open ? "" : "-rotate-90"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {title}
            </h2>
          </button>
        ) : (
          <h2 className="flex-1 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {title}
          </h2>
        )}
        {actions}
      </header>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}