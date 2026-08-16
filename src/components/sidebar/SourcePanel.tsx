import { useVeraMarkStore } from "../../stores/useVeraMarkStore";
import { SingleSourcePanel } from "./SingleSourcePanel";
import { BatchSourcePanel } from "./BatchSourcePanel";

export function SourcePanel() {
  const mode = useVeraMarkStore((state) => state.mode);
  return mode === "single" ? <SingleSourcePanel /> : <BatchSourcePanel />;
}