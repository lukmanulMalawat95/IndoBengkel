import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-medium leading-none",
  {
    variants: {
      variant: {
        default: "border-line bg-surface2 text-muted",
        accent: "border-accent/20 bg-accent/[0.07] text-accent",
        lime: "border-lime/20 bg-lime/[0.07] text-lime",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        danger: "border-danger/30 bg-danger/10 text-danger",
        outline: "border-line bg-transparent text-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
