"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
        >
          <Star
            className={cn(
              "h-6 w-6",
              star <= value ? "fill-accent text-accent" : "text-lineStrong",
            )}
          />
        </button>
      ))}
    </div>
  );
}
