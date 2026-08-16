import type { ReactNode, SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({
  label,
  className = "",
  children,
  ...rest
}: SelectProps) {
  return (
    <label className="block text-sm">
      {label ? (
        <span className="mb-1 block text-zinc-300">{label}</span>
      ) : null}
      <select
        className={`w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}