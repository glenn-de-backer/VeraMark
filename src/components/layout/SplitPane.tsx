import type { ReactNode } from "react";

interface SplitPaneProps {
  sidebar: ReactNode;
  content: ReactNode;
}

export function SplitPane({ sidebar, content }: SplitPaneProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-900">
        {sidebar}
      </aside>
      <main className="relative flex-1 overflow-hidden">{content}</main>
    </div>
  );
}