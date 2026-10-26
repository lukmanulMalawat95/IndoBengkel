import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  size = "sm",
  showValue = false,
  className,
}: {
  value: number;
  size?: "xs" | "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}) {
  const sizeClass = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }[size];

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClass,
              star <= Math.round(value) ? "fill-accent text-accent" : "text-lineStrong",
            )}
          />
        ))}
      </span>
      {showValue ? <span className="text-xs font-medium text-fg">{value.toFixed(1)}</span> : null}
    </span>
  );
}
