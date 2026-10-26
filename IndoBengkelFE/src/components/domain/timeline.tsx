"use client";

import { Check, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  key: string;
  label: string;
  date?: string;
  state: "done" | "current" | "pending" | "failed";
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="space-y-0">
      {items.map((item, index) => (
        <li key={item.key} className="relative flex gap-3 pb-5 last:pb-0">
          {index < items.length - 1 ? (
            <span
              className={cn(
                "absolute left-[9px] top-5 h-full w-px",
                item.state === "done" ? "bg-accent/40" : "bg-line",
              )}
            />
          ) : null}
          <span
            className={cn(
              "relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border",
              item.state === "done"
                ? "border-accent bg-accent text-accentInk"
                : item.state === "current"
                  ? "border-accent bg-surface text-accent"
                  : item.state === "failed"
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-line bg-surface text-faint",
            )}
          >
            {item.state === "done" ? (
              <Check className="h-3 w-3" />
            ) : item.state === "failed" ? (
              <X className="h-3 w-3" />
            ) : (
              <Circle className="h-2 w-2 fill-current" />
            )}
          </span>
          <div className="min-w-0 pt-0.5">
            <p
              className={cn(
                "text-xs font-medium",
                item.state === "pending" ? "text-faint" : "text-fg",
              )}
            >
              {item.label}
            </p>
            {item.date ? <p className="mt-0.5 text-[11px] text-faint">{item.date}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
