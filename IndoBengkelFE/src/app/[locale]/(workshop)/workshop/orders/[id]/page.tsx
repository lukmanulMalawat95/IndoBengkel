"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  Package,
  PackageCheck,
  Play,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/label";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import {
  useMarkOrderPreparing,
  useMarkOrderReady,
  useOrder,
  useShipOrder,
  useVerifyPickup,
} from "@/lib/api/hooks";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { courierName } from "@/lib/shipping";

export default function WorkshopOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const orderQuery = useOrder(id);
  const markPreparing = useMarkOrderPreparing();
  const markReady = useMarkOrderReady();
  const verifyPickup = useVerifyPickup();
  const shipOrder = useShipOrder();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [shipError, setShipError] = useState("");

  if (orderQuery.isLoading) return <PageLoading />;
  if (orderQuery.isError || !orderQuery.data) {
    return <ErrorState onRetry={() => orderQuery.refetch()} />;
  }

  const order = orderQuery.data;

  const submitVerify = async () => {
    setError("");
    try {
      await verifyPickup.mutateAsync({ id: order.id, pickupCode: code });
      setVerifyOpen(false);
      setCode("");
      toast.success(t("console.pickupVerified"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("console.invalidPickupCode");
      setError(message);
      toast.error(message);
    }
  };

  const submitShip = async () => {
    setShipError("");
    try {
      await shipOrder.mutateAsync({ id: order.id, trackingNumber: tracking });
      setShipOpen(false);
      setTracking("");
      toast.success(t("console.shippedSuccess"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toasts.error");
      setShipError(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-5">
      <Link
        href="/workshop/orders"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("console.orders")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="order" status={order.status} />
            <span className="font-mono text-xs text-muted">{order.code}</span>
          </div>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("console.orderDetail")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {order.customerName} · {order.customerPhone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === "paid" ? (
            <Button
              size="sm"
              disabled={markPreparing.isPending}
              onClick={async () => {
                try {
                  await markPreparing.mutateAsync(order.id);
                  toast.success(t("toasts.saved"));
                } catch (caught) {
                  toast.error(caught instanceof Error ? caught.message : t("toasts.error"));
                }
              }}
            >
              {markPreparing.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {t("console.markPreparing")}
            </Button>
          ) : null}
          {order.status === "preparing" ? (
            <Button
              size="sm"
              disabled={markReady.isPending}
              onClick={async () => {
                try {
                  await markReady.mutateAsync(order.id);
                  toast.success(t("toasts.saved"));
                } catch (caught) {
                  toast.error(caught instanceof Error ? caught.message : t("toasts.error"));
                }
              }}
            >
              {markReady.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
              {t("console.markReady")}
            </Button>
          ) : null}
          {order.status === "ready_for_pickup" && order.fulfillment === "pickup" ? (
            <Button size="sm" onClick={() => setVerifyOpen(true)}>
              <ShieldCheck className="h-4 w-4" /> {t("console.verifyPickup")}
            </Button>
          ) : null}
          {order.status === "ready_for_pickup" && order.fulfillment === "expedition" ? (
            <Button size="sm" onClick={() => setShipOpen(true)}>
              <Truck className="h-4 w-4" /> {t("console.shipOrder")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{t("console.orderDetail")}</CardTitle>
              <Badge variant="outline">{order.items.length} {t("common.items")}</Badge>
            </CardHeader>
            <CardContent className="divide-y divide-line">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={item.titleSnapshot}
                    className="h-14 w-14 shrink-0 rounded-input"
                    sizes="56px"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{item.titleSnapshot}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {item.qty} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-fg">{formatCurrency(item.subtotal)}</p>
                </div>
              ))}
            </CardContent>
            <div className="space-y-2 border-t border-line p-5 text-xs">
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

          {order.status === "ready_for_pickup" && order.fulfillment === "pickup" ? (
            <Card className="border-lime/25 bg-lime/5 p-5 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-lime">{t("console.pickupCode")}</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-[0.18em] text-fg">{order.pickupCode}</p>
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
                <h2 className="font-heading text-base font-semibold text-fg">
                  {t("console.deliveryAddress")}
                </h2>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("checkout.courier")}</span>
                  <span className="text-fg">
                    {courierName(order.shipping.courier)}
                  </span>
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
                <div className="rounded-input border border-line bg-surface2/50 p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
                    {t("orders.trackingNumber")}
                  </p>
                  <p className="mt-1 font-mono text-xs text-fg">
                    {order.shipping.trackingNumber ?? t("console.trackingNotSet")}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs text-muted">
              <Package className="h-4 w-4 text-accent" /> {t("console.customer")}
            </p>
            <p className="mt-2 text-sm font-medium text-fg">{order.customerName}</p>
            <p className="mt-0.5 text-xs text-muted">{order.customerPhone}</p>
            <p className="mt-2 text-[11px] text-faint">{formatDateTime(order.createdAt)}</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs text-muted">{t("console.status")}</p>
            <ol className="mt-3 space-y-2 text-xs">
              {[
                { label: t("orders.paidAt"), at: order.paidAt },
                { label: t("console.preparing"), at: order.preparingAt },
                { label: t("console.ready"), at: order.readyAt },
                ...(order.fulfillment === "expedition"
                  ? [{ label: t("console.shipped"), at: order.shipping?.shippedAt }]
                  : []),
                { label: t("console.completed"), at: order.completedAt },
              ].map((step) => (
                <li key={step.label} className="flex items-center gap-2">
                  <CheckCircle2
                    className={step.at ? "h-3.5 w-3.5 text-success" : "h-3.5 w-3.5 text-faint"}
                  />
                  <span className={step.at ? "text-fg" : "text-muted"}>{step.label}</span>
                  <span className="ml-auto text-[10px] text-faint">
                    {step.at ? formatDateTime(step.at) : "—"}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] leading-relaxed text-muted">
              {order.fulfillment === "expedition"
                ? t("console.deliveryNote")
                : t("cart.pickupNote")}
            </p>
          </Card>
        </aside>
      </div>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.shipTitle")}</DialogTitle>
            <DialogDescription>{t("console.shipBody")}</DialogDescription>
          </DialogHeader>
          <Field label={t("orders.trackingNumber")} error={shipError || undefined}>
            <Input
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder={t("console.trackingPlaceholder")}
              className="font-mono uppercase"
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShipOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={submitShip}
              disabled={shipOrder.isPending || tracking.trim().length < 4}
            >
              {shipOrder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              {t("console.shipAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.verifyPickup")}</DialogTitle>
            <DialogDescription>{t("console.verifyPickupBody")}</DialogDescription>
          </DialogHeader>
          <Field label={t("console.pickupCode")} error={error || undefined}>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="••••••"
              className="text-center font-mono text-lg uppercase tracking-[0.3em]"
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setVerifyOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submitVerify} disabled={verifyPickup.isPending || code.length < 4}>
              {verifyPickup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t("console.verify")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
