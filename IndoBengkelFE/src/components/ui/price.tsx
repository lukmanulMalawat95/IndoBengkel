import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Price({
  value,
  original,
  className,
  size = "md",
}: {
  value: number;
  original?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  }[size];

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-2", className)}>
      <span className={cn("font-heading font-semibold tracking-tight text-fg", sizeClass)}>
        {formatCurrency(value)}
      </span>
      {original && original > value ? (
        <span className="text-xs text-faint line-through">{formatCurrency(original)}</span>
      ) : null}
    </span>
  );
}
