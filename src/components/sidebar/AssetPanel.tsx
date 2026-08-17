import { LabelCatalog } from "../catalog/LabelCatalog";
import { Panel } from "../ui/Panel";
import { TransformPanel } from "./TransformPanel";

/**
 * Left rail — visual creative tools. The label catalog grid gets the whole
 * column so 3–4 badges stay visible without scrolling; placement/transform
 * lives beneath it as a collapsible section.
 */
export function AssetPanel() {
  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-900">
      <Panel title="Label catalog" disableCollapse compact>
        <LabelCatalog />
      </Panel>
      <Panel title="Placement & transform" defaultOpen={false} compact>
        <TransformPanel />
      </Panel>
    </aside>
  );
}