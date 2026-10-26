import { cn } from "@/lib/utils";

/**
 * IndoBengkel mark — a squared B on an ink tile.
 * Drawn on the 32 px grid in design/indobengkel-logo.pen (Sample 2).
 * Ink and lime are brand constants: the tile stays ink in both modes and the
 * glyph stays lime, so the mark never mixes with the Day Shift olive accent.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("h-8 w-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8.96" className="fill-ink" />
      <g className="fill-lime">
        <rect x="7.52" y="6.24" width="4.16" height="20" rx="2.08" />
        <rect x="7.52" y="6.24" width="17.28" height="10.08" rx="4.16" />
        <rect x="7.52" y="15.68" width="17.28" height="10.56" rx="4.16" />
      </g>
      <path
        d="M11.68 8.48H20.64A1.92 1.92 0 0 1 22.56 10.4V12.16A1.92 1.92 0 0 1 20.64 14.08H11.68Z"
        className="fill-ink"
      />
      <path
        d="M11.68 17.92H20.48A2.08 2.08 0 0 1 22.56 20V21.92A2.08 2.08 0 0 1 20.48 24H11.68Z"
        className="fill-ink"
      />
    </svg>
  );
}
