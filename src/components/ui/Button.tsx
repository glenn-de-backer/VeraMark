import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-sky-600 text-white hover:bg-sky-500 focus-visible:outline-sky-400 disabled:bg-zinc-700 disabled:text-zinc-400",
  secondary:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:outline-zinc-500 disabled:bg-zinc-800 disabled:text-zinc-500",
  ghost:
    "text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-zinc-500",
  danger:
    "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-400 disabled:bg-zinc-700 disabled:text-zinc-400",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}