"use client";

import { ArrowRight, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { useWorkshopOrders } from "@/lib/api/hooks";
import type { Order } from "@/lib/api/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const filters = ["paid", "preparing", "ready_for_pickup", "shipped", "completed", "all"] as const;

export default function WorkshopOrdersPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<(typeof filters)[number]>("paid");
  const ordersQuery = useWorkshopOrders(status === "all" ? undefined : status);

  if (ordersQuery.isLoading) return <PageLoading />;
  if (ordersQuery.isError) return <ErrorState onRetry={() => ordersQuery.refetch()} />;

  const orders = ordersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.orders")}
        title={t("console.orders")}
        description={t("console.ordersSubtitle")}
      />

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatus(filter)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              status === filter
                ? "border-accent/40 bg-accent/12 text-accent"
                : "border-line bg-surface text-muted hover:text-fg",
            )}
          >
            {filter === "all" ? t("console.all") : t(`status.order.${filter}`)}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("console.noOrders")}
          description={t("console.noOrdersBody")}
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </Card>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const t = useTranslations();
  return (
    <Link
      href={`/workshop/orders/${order.id}`}
      className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface2/50 lg:flex-row lg:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex -space-x-2">
          {order.items.slice(0, 3).map((item) => (
            <ImageWithFallback
              key={item.id}
              src={item.imageUrl}
              alt={item.titleSnapshot}
              className="h-12 w-12 rounded-input border-2 border-surface"
              sizes="48px"
            />
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-fg">{order.customerName}</p>
            <StatusBadge kind="order" status={order.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
            <span className="font-mono">{order.code}</span> · {order.items.length} {t("common.items")}
          </p>
          <p className="mt-1 text-[11px] text-faint">{formatDateTime(order.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:justify-end">
        {order.status === "ready_for_pickup" && order.fulfillment === "pickup" ? (
          <Badge variant="lime" className="font-mono">{order.pickupCode}</Badge>
        ) : null}
        {order.status === "ready_for_pickup" && order.fulfillment === "expedition" ? (
          <Badge variant="accent">{t("console.shipOrder")}</Badge>
        ) : null}
        <p className="font-heading text-sm font-semibold text-fg">{formatCurrency(order.total)}</p>
        <Button asChild variant="secondary" size="sm">
          <span>
            {t("common.manage")} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Button>
      </div>
    </Link>
  );
}
