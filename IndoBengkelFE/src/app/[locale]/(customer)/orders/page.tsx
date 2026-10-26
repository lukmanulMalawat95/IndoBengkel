"use client";

import { ArrowRight, Package, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageLoading } from "@/components/ui/page-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useOrders } from "@/lib/api/hooks";
import type { Order, OrderStatus } from "@/lib/api/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { courierName } from "@/lib/shipping";
import { cn } from "@/lib/utils";

const filters: (OrderStatus | "all")[] = [
  "all",
  "pending_payment",
  "paid",
  "preparing",
  "ready_for_pickup",
  "shipped",
  "completed",
  "cancelled",
];

export default function OrdersPage() {
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  const ordersQuery = useOrders(Boolean(user));
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <Package className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.signInToContinue")}</p>
        <Button asChild className="mt-4">
          <Link href="/auth/login?returnTo=/orders">{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (ordersQuery.isLoading) return <PageLoading />;
  if (ordersQuery.isError) return <ErrorState onRetry={() => ordersQuery.refetch()} />;

  const orders = (ordersQuery.data ?? []).filter((order) => status === "all" || order.status === status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("nav.shop")}</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("orders.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("orders.subtitle")}</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/shop">
            <ShoppingBag className="h-4 w-4" /> {t("orders.browseShop")}
          </Link>
        </Button>
      </div>

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
            {filter === "all" ? t("common.all") : t(`status.order.${filter}`)}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("orders.empty")}
          description={t("orders.emptyBody")}
          action={
            <Button asChild>
              <Link href="/shop">{t("orders.browseShop")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const t = useTranslations();
  const showPickup =
    order.fulfillment === "pickup" &&
    ["paid", "preparing", "ready_for_pickup"].includes(order.status) &&
    Boolean(order.pickupCode);
  const showDelivery = order.fulfillment === "expedition";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="order" status={order.status} />
          <span className="font-mono text-[11px] text-muted">{order.code}</span>
          <span className="text-[11px] text-faint">{formatDateTime(order.createdAt)}</span>
        </div>
        <span className="text-xs text-muted">{order.workshopName}</span>
      </div>
      <div className="flex gap-3 p-4">
        <div className="flex -space-x-2">
          {order.items.slice(0, 3).map((item) => (
            <ImageWithFallback
              key={item.id}
              src={item.imageUrl}
              alt={item.titleSnapshot}
              className="h-14 w-14 rounded-input border-2 border-surface"
              sizes="56px"
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm text-fg">
            {order.items.map((item) => `${item.qty}× ${item.titleSnapshot}`).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span>{order.items.reduce((total, item) => total + item.qty, 0)} {t("common.items")}</span>
            <span className="text-faint">·</span>
            <span>{t("orders.total")}: <span className="font-medium text-fg">{formatCurrency(order.total)}</span></span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          {showPickup ? (
            <Badge variant="lime" className="font-mono">{order.pickupCode}</Badge>
          ) : null}
          {showDelivery ? (
            <Badge variant="accent">
              {order.shipping?.courier ? courierName(order.shipping.courier) : t("checkout.expedition")}
            </Badge>
          ) : null}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/orders/${order.id}`}>
              {t("common.details")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
