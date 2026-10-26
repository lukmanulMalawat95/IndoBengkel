import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  accent?: "lime" | "accent" | "warning" | "danger";
  className?: string;
}) {
  const iconColor = {
    lime: "text-lime",
    accent: "text-accent",
    warning: "text-warning",
    danger: "text-danger",
  }[accent ?? "accent"];

  return (
    <div className={cn("rounded-card border border-line bg-surface p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4", iconColor)} /> : null}
      </div>
      <div className="mt-3 font-heading text-2xl font-semibold tracking-tight text-fg">{value}</div>
      {hint ? <div className="mt-1 text-xs text-faint">{hint}</div> : null}
    </div>
  );
}
