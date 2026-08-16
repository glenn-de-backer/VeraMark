import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Panel({ title, children, actions }: PanelProps) {
  return (
    <section className="border-b border-zinc-800 px-4 py-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </h2>
        {actions}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}