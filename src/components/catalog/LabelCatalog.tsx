import { useEffect } from "react";
import { Button } from "../ui/Button";
import { tauri } from "../../services/tauri";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";

export function LabelCatalog() {
  const labels = useVeraMarkStore((state) => state.labels);
  const selectedLabelId = useVeraMarkStore((state) => state.selectedLabelId);
  const labelsLoading = useVeraMarkStore((state) => state.labelsLoading);
  const labelsDirectory = useVeraMarkStore((state) => state.labelsDirectory);

  useEffect(() => {
    const store = useVeraMarkStore.getState();
    store.setLabelsLoading(true);
    void tauri
      .loadLabels()
      .then((result) => {
        store.setLabels(result.labels, result.directory, result.errors);
        if (!result.labels.some((label) => label.id === store.selectedLabelId)) {
          store.setSelectedLabelId(result.labels[0]?.id ?? "");
        }
        store.setLastError(null);
      })
      .catch((error) => store.setLastError(String(error)))
      .finally(() => store.setLabelsLoading(false));
  }, []);

  async function refresh() {
    const store = useVeraMarkStore.getState();
    store.setLabelsLoading(true);
    try {
      const result = await tauri.refreshLabels();
      store.setLabels(result.labels, result.directory, result.errors);
    } catch (error) {
      store.setLastError(String(error));
    } finally {
      store.setLabelsLoading(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {labels.map((label) => {
          const active = label.id === selectedLabelId;
          return (
            <button
              key={label.id}
              type="button"
              onClick={() =>
                useVeraMarkStore.getState().setSelectedLabelId(label.id)
              }
              title={label.name}
              className={`group flex w-full items-center justify-center rounded-md border p-2 transition-colors ${
                active
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
              }`}
            >
              <img
                src={label.dataUrl}
                alt={label.name}
                className="h-12 w-full object-contain"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      {labels.length === 0 && !labelsLoading && (
        <p className="text-xs text-zinc-500">
          No label assets found. Add SVG/PNG badges to the labels directory to
          get started.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={labelsLoading} onClick={() => void refresh()}>
          {labelsLoading ? "Scanning…" : "Refresh"}
        </Button>
        <span className="truncate text-[10px] text-zinc-500" title={labelsDirectory ?? ""}>
          {formatDirectory(labelsDirectory)}
        </span>
      </div>
    </div>
  );
}

function formatDirectory(dir: string | null): string {
  if (!dir) return "";
  if (dir.length <= 40) return dir;
  return `…${dir.slice(-38)}`;
}