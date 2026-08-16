import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { SplitPane } from "./components/layout/SplitPane";
import { ControlPanel } from "./components/sidebar/ControlPanel";
import { PreviewCanvas } from "./components/canvas/PreviewCanvas";
import {
  tauri,
  BATCH_COMPLETE_EVENT,
  BATCH_PROGRESS_EVENT,
  LABELS_CHANGED_EVENT,
} from "./services/tauri";
import type { BatchProgress, BatchResult } from "./models/c2pa";
import { useVeraMarkStore } from "./stores/useVeraMarkStore";

export default function App() {
  useEffect(() => {
    const unlisteners: Promise<UnlistenFn>[] = [];

    unlisteners.push(
      listen<BatchProgress>(BATCH_PROGRESS_EVENT, (event) => {
        useVeraMarkStore.getState().setProgress(event.payload);
      }),
    );

    unlisteners.push(
      listen<BatchResult>(BATCH_COMPLETE_EVENT, (event) => {
        const summary = event.payload;
        useVeraMarkStore.getState().setBatchRunning(false);
        useVeraMarkStore.getState().setProgress(null);
        useVeraMarkStore
          .getState()
          .setLastMessage(
            `Batch complete: ${summary.processed} processed, ${summary.failed} failed.`,
          );
      }),
    );

    unlisteners.push(
      listen(LABELS_CHANGED_EVENT, () => {
        void tauri.refreshLabels().then((result) => {
          const store = useVeraMarkStore.getState();
          store.setLabels(result.labels, result.directory, result.errors);
        });
      }),
    );

    void tauri.watchLabels().catch((error) => {
      useVeraMarkStore.getState().setLastError(String(error));
    });

    return () => {
      for (const promise of unlisteners) {
        void promise.then((unlisten) => unlisten());
      }
    };
  }, []);

  return <SplitPane sidebar={<ControlPanel />} content={<PreviewCanvas />} />;
}