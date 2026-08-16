import type { InputHTMLAttributes } from "react";

interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: string;
  valueLabel?: string;
  onChange: (value: number) => void;
}

export function Slider({
  label,
  valueLabel,
  min = 0,
  max = 100,
  step = 1,
  value = 0,
  disabled = false,
  onChange,
  ...rest
}: SliderProps) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-xs text-zinc-400">
          {valueLabel ?? String(value)}
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-sky-500 disabled:cursor-not-allowed"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        {...rest}
      />
    </label>
  );
}