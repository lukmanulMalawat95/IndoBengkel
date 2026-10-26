"use client";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  ShoppingBag,
  Star,
  Truck,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ReviewDialog } from "@/components/domain/review-dialog";
import { Timeline, type TimelineItem } from "@/components/domain/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageLoading } from "@/components/ui/page-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import {
  useCancelOrder,
  useConfirmDelivery,
  useOrder,
  useSimulateOrderPayment,
  useStartConversation,
} from "@/lib/api/hooks";
import type { Order, OrderItem } from "@/lib/api/types";
import { formatCurrency, formatDateTime, minutesUntil } from "@/lib/format";
import { courierName } from "@/lib/shipping";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const orderQuery = useOrder(id, Boolean(user));
  const pay = useSimulateOrderPayment();
  const cancel = useCancelOrder();
  const confirmDelivery = useConfirmDelivery();
  const startConversation = useStartConversation();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <Package className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <Button asChild className="mt-4">
          <Link href={`/auth/login?returnTo=/orders/${id}`}>{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (orderQuery.isLoading) return <PageLoading />;
  if (orderQuery.isError || !orderQuery.data) {
    return <ErrorState title={t("orders.orderNotFound")} onRetry={() => orderQuery.refetch()} />;
  }

  const order = orderQuery.data;
  const remaining = Math.max(0, minutesUntil(order.expiresAt));
  const canCancel = order.status === "pending_payment";
  const showPickup =
    order.fulfillment === "pickup" && ["paid", "preparing", "ready_for_pickup"].includes(order.status);

  const handleConfirmDelivery = async () => {
    try {
      await confirmDelivery.mutateAsync(order.id);
      toast.success(t("orders.deliveryConfirmed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const handlePay = async () => {
    try {
      await pay.mutateAsync(order.id);
      toast.success(t("toasts.paymentSimulated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync(order.id);
      setCancelOpen(false);
      toast.success(t("orders.cancelSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const handleChat = async () => {
    try {
      const conversation = await startConversation.mutateAsync(order.workshopId);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("orders.backToOrders")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="order" status={order.status} />
            <span className="font-mono text-xs text-muted">{order.code}</span>
          </div>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("orders.orderDetail")}
          </h1>
          <p className="mt-1 text-sm text-muted">{formatDateTime(order.createdAt)} · {order.workshopName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleChat} disabled={startConversation.isPending}>
            <MessageSquare className="h-4 w-4" /> {t("orders.chat")}
          </Button>
          {canCancel ? (
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4" /> {t("orders.cancelOrder")}
            </Button>
          ) : null}
        </div>
      </div>

      <OrderStatusBanner order={order} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <ShoppingBag className="h-4 w-4 text-accent" />
              <h2 className="font-heading text-base font-semibold text-fg">{t("orders.items")}</h2>
              <span className="ml-auto text-[11px] text-muted">{order.items.length} {t("common.items")}</span>
            </div>
            <div className="divide-y divide-line">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 p-4">
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={item.titleSnapshot}
                    className="h-16 w-16 shrink-0 rounded-input"
                    sizes="64px"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{item.titleSnapshot}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {item.qty} × {formatCurrency(item.unitPrice)}
                    </p>
                    {order.status === "completed" ? (
                      item.reviewed ? (
                        <Badge variant="success" className="mt-2">
                          <CheckCircle2 className="h-3 w-3" /> {t("orders.reviewed")}
                        </Badge>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-2"
                          onClick={() => setReviewItem(item)}
                        >
                          <Star className="h-3.5 w-3.5" /> {t("orders.reviewProduct")}
                        </Button>
                      )
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-medium text-fg">{formatCurrency(item.subtotal)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-line p-4 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("common.subtotal")}</span>
                <span className="text-fg">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("common.discount")}</span>
                <span className="text-fg">-{formatCurrency(order.discountTotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("checkout.shipping")}</span>
                <span className="text-fg">
                  {order.shippingCost > 0
                    ? formatCurrency(order.shippingCost)
                    : t("checkout.freePickup")}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium text-fg">{t("common.total")}</span>
                <span className="font-heading font-semibold text-fg">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-heading text-base font-semibold text-fg">{t("orders.timeline")}</h2>
            <div className="mt-4">
              <Timeline items={buildTimeline(order, t)} />
            </div>
          </Card>

          {order.fulfillment === "pickup" &&
          (order.status === "ready_for_pickup" || order.status === "preparing") ? (
            <Card className="border-lime/25 bg-lime/5 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-lime" />
                <div>
                  <h3 className="text-sm font-medium text-fg">{t("orders.pickupInstructions")}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t("orders.pickupInstructionsBody")}</p>
                </div>
              </div>
            </Card>
          ) : null}

          {order.fulfillment === "expedition" &&
          ["preparing", "ready_for_pickup", "shipped"].includes(order.status) ? (
            <Card className="border-accent/25 bg-accent/5 p-4">
              <div className="flex items-start gap-3">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h3 className="text-sm font-medium text-fg">{t("orders.deliveryInstructions")}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {t("orders.deliveryInstructionsBody")}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          {showPickup ? (
            <Card className="border-lime/30 bg-lime/5 p-5 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-lime">{t("orders.pickupCode")}</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-[0.18em] text-fg">{order.pickupCode}</p>
              <p className="mt-2 text-[11px] text-muted">{t("orders.showPickupCode")}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={async () => {
                  await navigator.clipboard.writeText(order.pickupCode);
                  toast.success(t("toasts.copied"));
                }}
              >
                <Copy className="h-3.5 w-3.5" /> {t("common.copy")}
              </Button>
            </Card>
          ) : null}

          {order.fulfillment === "expedition" && order.shipping ? (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-accent" />
                <h2 className="font-heading text-base font-semibold text-fg">{t("orders.delivery")}</h2>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("checkout.courier")}</span>
                  <span className="text-fg">
                    {courierName(order.shipping.courier)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("checkout.shipping")}</span>
                  <span className="text-fg">{formatCurrency(order.shipping.cost)}</span>
                </div>
                <div className="rounded-input border border-line bg-surface2/40 p-2.5 leading-relaxed text-muted">
                  <p className="font-medium text-fg">
                    {order.shipping.address.recipient} · {order.shipping.address.phone}
                  </p>
                  <p className="mt-1">
                    {order.shipping.address.line}, {order.shipping.address.city}{" "}
                    {order.shipping.address.postalCode}
                  </p>
                </div>
                {order.shipping.trackingNumber ? (
                  <div className="rounded-input border border-line bg-surface2/50 p-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
                      {t("orders.trackingNumber")}
                    </p>
                    <p className="mt-1 font-mono text-xs text-fg">{order.shipping.trackingNumber}</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">{t("orders.trackingPending")}</p>
                )}
              </div>
              {order.status === "shipped" ? (
                <Button
                  className="mt-3 w-full"
                  onClick={handleConfirmDelivery}
                  disabled={confirmDelivery.isPending}
                >
                  {confirmDelivery.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t("orders.confirmReceived")}
                </Button>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("orders.payment")}</h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("orders.paymentMethod")}</span>
                <span className="text-fg">{paymentLabel(order, t)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("common.status")}</span>
                <StatusBadge kind="payment" status={order.payment.status} />
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("common.total")}</span>
                <span className="font-medium text-fg">{formatCurrency(order.payment.amount)}</span>
              </div>
              {order.payment.vaNumber ? (
                <div className="rounded-input border border-line bg-surface2/50 p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{t("checkout.va")}</p>
                  <p className="mt-1 font-mono text-xs text-fg">{order.payment.vaNumber}</p>
                </div>
              ) : null}
              {order.status === "pending_payment" ? (
                <>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
                    <Clock3 className="h-3.5 w-3.5" />
                    {t("orders.expiresIn", { minutes: remaining })}
                  </div>
                  <Button className="mt-2 w-full" onClick={handlePay} disabled={pay.isPending}>
                    {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {t("orders.simulatePayment")}
                  </Button>
                  <p className="text-center text-[10px] text-faint">{t("orders.simulatePaymentHint")}</p>
                </>
              ) : null}
            </div>
          </Card>

          <Card className="p-4">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="block font-medium text-fg">{order.workshopName}</span>
                {order.fulfillment === "expedition"
                  ? t("checkout.expedition")
                  : t("common.pickupOnly")}{" "}
                · {t("common.idrOnly")}
              </span>
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
              <Link href={`/workshops/${order.workshopSlug}`}>{t("orders.contactWorkshop")}</Link>
            </Button>
          </Card>
        </aside>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orders.cancelOrder")}</DialogTitle>
            <DialogDescription>{t("orders.cancelConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={handleCancel} disabled={cancel.isPending}>
              {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {t("orders.cancelOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewDialog
        open={Boolean(reviewItem)}
        onOpenChange={(open) => {
          if (!open) setReviewItem(null);
        }}
        target="product"
        orderId={order.id}
        productId={reviewItem?.productId}
        onSubmitted={() => setReviewItem(null)}
      />
    </div>
  );
}

function buildTimeline(order: Order, t: ReturnType<typeof useTranslations>): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      key: "created",
      label: t("orders.createdAt"),
      date: formatDateTime(order.createdAt),
      state: "done",
    },
  ];

  if (order.status === "cancelled" || order.status === "expired") {
    items.push({
      key: "terminal",
      label: order.status === "cancelled" ? t("orders.cancelled") : t("orders.paymentExpired"),
      date: formatDateTime(order.cancelledAt ?? order.expiresAt),
      state: "failed",
    });
    return items;
  }

  items.push({
    key: "paid",
    label: t("orders.paidAt"),
    date: order.paidAt ? formatDateTime(order.paidAt) : undefined,
    state: order.paidAt ? "done" : order.status === "pending_payment" ? "current" : "done",
  });
  items.push({
    key: "preparing",
    label: t("orders.preparingAt"),
    date: order.preparingAt ? formatDateTime(order.preparingAt) : undefined,
    state: order.preparingAt ? "done" : order.status === "paid" ? "current" : "pending",
  });
  items.push({
    key: "ready",
    label: t("orders.readyAt"),
    date: order.readyAt ? formatDateTime(order.readyAt) : undefined,
    state: order.readyAt ? "done" : order.status === "preparing" ? "current" : "pending",
  });
  if (order.fulfillment === "expedition") {
    items.push({
      key: "shipped",
      label: t("orders.shippedAt"),
      date: order.shipping?.shippedAt ? formatDateTime(order.shipping.shippedAt) : undefined,
      state: order.shipping?.shippedAt
        ? "done"
        : order.status === "ready_for_pickup"
          ? "current"
          : "pending",
    });
    items.push({
      key: "completed",
      label: t("orders.completedAt"),
      date: order.completedAt ? formatDateTime(order.completedAt) : undefined,
      state: order.completedAt ? "done" : order.status === "shipped" ? "current" : "pending",
    });
  } else {
    items.push({
      key: "completed",
      label: t("orders.completedAt"),
      date: order.completedAt ? formatDateTime(order.completedAt) : undefined,
      state: order.completedAt
        ? "done"
        : order.status === "ready_for_pickup"
          ? "current"
          : "pending",
    });
  }

  return items;
}

function paymentLabel(order: Order, t: ReturnType<typeof useTranslations>) {
  const method = order.payment.method;
  if (method === "va") return t("checkout.va");
  if (method === "bank_transfer") return t("checkout.bank_transfer");
  if (method === "qris") return t("checkout.qris");
  return t("bookings.payCash");
}

function OrderStatusBanner({ order }: { order: Order }) {
  const t = useTranslations();
  const config: Record<string, { title: string; body: string; tone: string }> = {
    pending_payment: { title: t("orders.paymentPending"), body: t("orders.paymentPendingBody"), tone: "border-warning/25 bg-warning/5 text-warning" },
    paid: { title: t("orders.paidAt"), body: t("orders.preparingBody"), tone: "border-accent/25 bg-accent/5 text-accent" },
    preparing: { title: t("orders.preparing"), body: t("orders.preparingBody"), tone: "border-accent/25 bg-accent/5 text-accent" },
    ready_for_pickup: { title: t("orders.ready"), body: t("orders.readyBody"), tone: "border-lime/25 bg-lime/5 text-lime" },
    shipped: { title: t("orders.shipped"), body: t("orders.shippedBody"), tone: "border-accent/25 bg-accent/5 text-accent" },
    completed: { title: t("orders.completed"), body: t("orders.completedBody"), tone: "border-success/25 bg-success/5 text-success" },
    cancelled: { title: t("orders.cancelled"), body: t("orders.cancelledBody"), tone: "border-danger/25 bg-danger/5 text-danger" },
    expired: { title: t("orders.paymentExpired"), body: t("orders.paymentExpiredBody"), tone: "border-danger/25 bg-danger/5 text-danger" },
  };
  const item = config[order.status];
  if (!item) return null;
  return (
    <div className={`flex items-start gap-3 rounded-card border p-4 ${item.tone}`}>
      <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-fg">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted">{item.body}</p>
      </div>
    </div>
  );
}
