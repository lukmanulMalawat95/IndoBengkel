"use client";

import { useTranslations } from "next-intl";
import { Badge } from "./badge";

type Kind = "service" | "order" | "workshop" | "payment" | "review";

const variantByStatus: Record<string, "default" | "accent" | "success" | "warning" | "danger" | "lime"> = {
  requested: "warning",
  confirmed: "accent",
  in_progress: "lime",
  awaiting_approval: "warning",
  completed: "success",
  paid: "success",
  declined: "danger",
  cancelled: "danger",
  no_show: "danger",
  pending_payment: "warning",
  preparing: "accent",
  ready_for_pickup: "lime",
  shipped: "accent",
  expired: "danger",
  draft: "default",
  active: "success",
  suspended: "danger",
  pending: "warning",
  failed: "danger",
  published: "success",
  hidden: "danger",
};

export function StatusBadge({ kind, status }: { kind: Kind; status: string }) {
  const t = useTranslations("status");
  return (
    <Badge variant={variantByStatus[status] ?? "default"}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(`${kind}.${status}`)}
    </Badge>
  );
}
