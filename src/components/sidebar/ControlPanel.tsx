import { Panel } from "../ui/Panel";
import { LabelCatalog } from "../catalog/LabelCatalog";
import { SourcePanel } from "./SourcePanel";
import { TransformPanel } from "./TransformPanel";
import { ExportPanel } from "./ExportPanel";
import { ProvenancePanel } from "./ProvenancePanel";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";
import type { ProcessingMode } from "../../stores/useVeraMarkStore";

export function ControlPanel() {
  return (
    <div>
      <Panel title="Processing mode">
        <ModeToggle />
      </Panel>

      <Panel title="Source">
        <SourcePanel />
      </Panel>

      <Panel title="Label catalog">
        <LabelCatalog />
      </Panel>

      <Panel title="Transform">
        <TransformPanel />
      </Panel>

      <Panel title="Export format">
        <ExportPanel />
      </Panel>

      <Panel title="Provenance (C2PA)">
        <ProvenancePanel />
      </Panel>
    </div>
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
    <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-800 p-1">
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
            className={`rounded px-2 py-1.5 text-sm font-medium transition-colors ${
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