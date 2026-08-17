import { Panel } from "../ui/Panel";
import { ExportPanel } from "./ExportPanel";
import { ProvenancePanel } from "./ProvenancePanel";

/**
 * Right rail — metadata & export inspector. "What goes inside the image":
 * C2PA provenance on top, output format/compression below. Both stay visible
 * simultaneously (no accordion juggling while tuning badges and quality).
 */
export function InspectorPanel() {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-900">
      <Panel title="Provenance (C2PA)" compact>
        <ProvenancePanel />
      </Panel>
      <Panel title="Export settings" compact>
        <ExportPanel />
      </Panel>
    </aside>
  );
}