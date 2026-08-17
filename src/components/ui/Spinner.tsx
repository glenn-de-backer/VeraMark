interface SpinnerProps {
  className?: string;
}

/** Simple branded loading spinner (animate-spin ring). */
export function Spinner({ className = "" }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 animate-spin text-sky-400 ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}