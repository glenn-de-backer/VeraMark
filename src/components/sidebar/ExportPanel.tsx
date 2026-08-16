import { Select } from "../ui/Select";
import { Slider } from "../ui/Slider";
import { useVeraMarkStore } from "../../stores/useVeraMarkStore";
import type { ExportFormat } from "../../models/c2pa";

export function ExportPanel() {
  const format = useVeraMarkStore((state) => state.format);
  const jpegQuality = useVeraMarkStore((state) => state.jpegQuality);

  return (
    <div className="space-y-3">
      <Select
        label="Format"
        value={format}
        onChange={(event) => {
          const next = event.target.value as ExportFormat;
          useVeraMarkStore.getState().setFormat(next);
        }}
      >
        <option value="jpeg">JPEG (compressed)</option>
        <option value="png">PNG (lossless)</option>
      </Select>
      {format === "jpeg" && (
        <Slider
          label="JPEG quality"
          min={1}
          max={100}
          step={1}
          value={jpegQuality}
          valueLabel={`${jpegQuality}`}
          onChange={(value) => {
            useVeraMarkStore.getState().setJpegQuality(value);
          }}
        />
      )}
    </div>
  );
}