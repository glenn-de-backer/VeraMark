import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { AppHeader } from "./components/layout/AppHeader";
import { PreviewCanvas } from "./components/canvas/PreviewCanvas";
import { AssetPanel } from "./components/sidebar/AssetPanel";
import { InspectorPanel } from "./components/sidebar/InspectorPanel";
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

  // Hydrate persisted preferences (C2PA + export) from the settings JSON file.
  const hydrated = useRef(false);
  useEffect(() => {
    void tauri
      .loadSettings()
      .then((settings) => {
        const store = useVeraMarkStore.getState();
        store.setC2pa(settings.c2pa);
        store.setFormat(settings.format);
        store.setJpegQuality(settings.jpegQuality);
      })
      .catch(() => {
        // Keep defaults on any settings read failure.
      })
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  // Debounce-save preference changes back to the settings JSON file.
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useVeraMarkStore.subscribe((state, previous) => {
      if (
        !hydrated.current ||
        (state.c2pa === previous.c2pa &&
          state.format === previous.format &&
          state.jpegQuality === previous.jpegQuality)
      ) {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const current = useVeraMarkStore.getState();
        void tauri.saveSettings({
          c2pa: current.c2pa,
          format: current.format,
          jpegQuality: current.jpegQuality,
        });
      }, 400);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <AppHeader />
      <div className="flex min-h-0 min-w-0 flex-1">
        <AssetPanel />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <PreviewCanvas />
        </main>
        <InspectorPanel />
      </div>
    </div>
  );
}