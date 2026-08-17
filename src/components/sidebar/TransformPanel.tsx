import { Slider } from "../ui/Slider";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";
import type { Anchor, TransformConfig } from "../../models/label";
import { MAX_OFFSET_PX } from "../../models/label";

const DOT_POS: Record<Anchor, { x: number; y: number }> = {
  TopLeft: { x: 0.15, y: 0.15 },
  TopCenter: { x: 0.5, y: 0.15 },
  TopRight: { x: 0.85, y: 0.15 },
  Center: { x: 0.5, y: 0.5 },
  BottomLeft: { x: 0.15, y: 0.85 },
  BottomCenter: { x: 0.5, y: 0.85 },
  BottomRight: { x: 0.85, y: 0.85 },
};

export function TransformPanel() {
  const transform = useVeraMarkStore((state) => state.transform);
  const locked = useVeraMarkStore((state) => state.batchRunning);

  function setTransform(partial: Partial<TransformConfig>) {
    useVeraMarkStore.getState().setTransform(partial);
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 block text-sm text-zinc-300">Anchor</span>
        <div className="grid grid-cols-3 gap-1">
          {(["TopLeft", "TopCenter", "TopRight"] as Anchor[]).map((anchor) => (
            <AnchorButton key={anchor} anchor={anchor} />
          ))}
          <span />
          <AnchorButton anchor="Center" />
          <span />
          {(["BottomLeft", "BottomCenter", "BottomRight"] as Anchor[]).map(
            (anchor) => (
              <AnchorButton key={anchor} anchor={anchor} />
            ),
          )}
        </div>
      </div>

      <Slider
        label="Scale"
        min={0.01}
        max={1}
        step={0.01}
        value={transform.scale}
        valueLabel={`${Math.round(transform.scale * 100)}%`}
        disabled={locked}
        onChange={(value) => setTransform({ scale: value })}
      />

      <Slider
        label="Offset X (px)"
        min={0}
        max={MAX_OFFSET_PX}
        step={1}
        value={transform.offsetX}
        disabled={locked}
        onChange={(value) => setTransform({ offsetX: value })}
      />

      <Slider
        label="Offset Y (px)"
        min={0}
        max={MAX_OFFSET_PX}
        step={1}
        value={transform.offsetY}
        disabled={locked}
        onChange={(value) => setTransform({ offsetY: value })}
      />
    </div>
  );
}

function AnchorButton({ anchor }: { anchor: Anchor }) {
  const active = useVeraMarkStore((state) => state.transform.anchor === anchor);
  const locked = useVeraMarkStore((state) => state.batchRunning);
  const position = DOT_POS[anchor];

  return (
    <button
      type="button"
      disabled={locked}
      title={anchor}
      onClick={() => useVeraMarkStore.getState().setTransform({ anchor })}
      className={`relative h-9 rounded border transition-colors ${
        active
          ? "border-sky-500 bg-sky-500/15"
          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span
        className={`absolute h-1.5 w-1.5 rounded-full ${
          active ? "bg-sky-300" : "bg-zinc-400"
        }`}
        style={{
          left: `${Math.round(position.x * 100)}%`,
          top: `${Math.round(position.y * 100)}%`,
          transform: "translate(-50%, -50%)",
        }}
      />
    </button>
  );
}