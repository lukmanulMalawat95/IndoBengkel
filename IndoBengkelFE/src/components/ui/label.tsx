import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)} {...props}>
      <span className="flex items-baseline justify-between gap-3 text-xs font-medium uppercase tracking-[0.12em] text-muted">
        <span>{children}</span>
        {hint ? <span className="normal-case tracking-normal text-faint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{label}</span>
        {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
