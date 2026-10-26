"use client";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Star,
  Wrench,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
  useApproveEstimate,
  useCancelBooking,
  usePayServiceOrder,
  useRejectEstimate,
  useServiceOrder,
  useSimulateServicePayment,
  useStartConversation,
} from "@/lib/api/hooks";
import type { PaymentMethod, ServiceOrder } from "@/lib/api/types";
import { formatCurrency, formatDateTime, minutesUntil } from "@/lib/format";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const bookingQuery = useServiceOrder(id, Boolean(user));
  const approve = useApproveEstimate();
  const reject = useRejectEstimate();
  const pay = usePayServiceOrder();
  const simulate = useSimulateServicePayment();
  const cancel = useCancelBooking();
  const startConversation = useStartConversation();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <CalendarClock className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <Button asChild className="mt-4">
          <Link href={`/auth/login?returnTo=/bookings/${id}`}>{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (bookingQuery.isLoading) return <PageLoading />;
  if (bookingQuery.isError || !bookingQuery.data) {
    return <ErrorState title={t("bookings.bookingNotFound")} onRetry={() => bookingQuery.refetch()} />;
  }

  const booking = bookingQuery.data;
  const canCancel =
    ["requested", "confirmed"].includes(booking.status) &&
    new Date(booking.scheduledAt).getTime() - Date.now() > 2 * 60 * 60 * 1000;
  const pendingPayment = booking.payment?.status === "pending" ? booking.payment : undefined;
  const paymentExpired = booking.payment?.status === "expired";
  const remaining = pendingPayment ? Math.max(0, minutesUntil(pendingPayment.expiresAt)) : 0;

  const handleChat = async () => {
    try {
      const conversation = await startConversation.mutateAsync(booking.workshopId);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const handlePay = async (method: PaymentMethod) => {
    try {
      await pay.mutateAsync({ id: booking.id, method });
      toast.success(
        method === "cash" ? t("toasts.invoicePaid") : t("bookings.paymentCreated"),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const handleSimulate = async () => {
    try {
      await simulate.mutateAsync(booking.id);
      toast.success(t("toasts.paymentSimulated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync(booking.id);
      setCancelOpen(false);
      toast.success(t("toasts.bookingCancelled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/bookings" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("bookings.backToBookings")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="service" status={booking.status} />
            <span className="font-mono text-xs text-muted">{booking.code}</span>
          </div>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("bookings.booking")} · {booking.workshopName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(booking.scheduledAt, locale as "en" | "id")} · {booking.vehicleLabel} · {booking.plateNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleChat} disabled={startConversation.isPending}>
            <MessageSquare className="h-4 w-4" /> {t("bookings.chatWithWorkshop")}
          </Button>
          {canCancel ? (
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4" /> {t("bookings.cancelBooking")}
            </Button>
          ) : null}
        </div>
      </div>

      <BookingStatusBanner booking={booking} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {booking.status === "awaiting_approval" ? (
            <Card className="border-warning/35 bg-warning/5 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <h2 className="font-heading text-base font-semibold text-fg">{t("bookings.estimateApprovalTitle")}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t("bookings.estimateApprovalBody")}</p>
                  <div className="mt-3 flex items-baseline gap-2 text-xs">
                    <span className="text-muted">{t("bookings.estimate")}:</span>
                    <span className="text-fg">
                      {booking.estimatedTotal === 0
                        ? t("booking.quoteAfter")
                        : formatCurrency(booking.estimatedTotal)}
                    </span>
                    <span className="text-faint">→</span>
                    <span className="font-heading text-lg font-semibold text-warning">{formatCurrency(booking.finalTotal ?? 0)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setApproveOpen(true)}>
                      <CheckCircle2 className="h-4 w-4" /> {t("bookings.approveEstimate")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRejectOpen(true)}>
                      <XCircle className="h-4 w-4" /> {t("bookings.rejectEstimate")}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("bookings.timeline")}</h2>
            <div className="mt-4">
              <Timeline items={buildTimeline(booking, t)} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Wrench className="h-4 w-4 text-accent" />
              <h2 className="font-heading text-base font-semibold text-fg">{t("bookings.invoice")}</h2>
              {booking.finalTotal ? (
                <Badge variant="outline" className="ml-auto">{t("bookings.finalNote")}</Badge>
              ) : null}
            </div>
            <div className="p-4">
              {booking.items.length === 0 ? (
                <p className="text-sm text-muted">{t("bookings.invoiceNote")}</p>
              ) : (
                <div className="space-y-2">
                  {booking.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="text-fg">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-faint">{t(`serviceKinds.${item.kind}`)} · {item.qty} × {formatCurrency(item.unitPrice)}</p>
                      </div>
                      <p className="shrink-0 font-medium text-fg">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("bookings.estimate")}</span>
                  <span className="text-fg">
                    {booking.estimatedTotal === 0
                      ? t("booking.quoteAfter")
                      : formatCurrency(booking.estimatedTotal)}
                  </span>
                </div>
                {booking.finalTotal ? (
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">{t("bookings.finalTotal")}</span>
                    <span className="font-heading font-semibold text-fg">{formatCurrency(booking.finalTotal)}</span>
                  </div>
                ) : null}
              </div>
              {!booking.finalTotal ? (
                <p className="mt-3 text-[11px] leading-relaxed text-faint">{t("bookings.estimateNote")}</p>
              ) : null}
            </div>
            {booking.status === "completed" ? (
              <div className="border-t border-line p-4">
                {pendingPayment ? (
                  <div>
                    <p className="text-sm font-medium text-fg">{t("bookings.paymentPendingTitle")}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {t("bookings.paymentPendingBody")}
                    </p>
                    <div className="mt-3 space-y-2 rounded-input border border-line bg-surface2/40 p-3 text-xs">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{t("bookings.paymentMethod")}</span>
                        <span className="text-fg">{paymentMethodLabel(pendingPayment.method, t)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{t("common.status")}</span>
                        <StatusBadge kind="payment" status={pendingPayment.status} />
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted">{t("common.total")}</span>
                        <span className="font-medium text-fg">{formatCurrency(pendingPayment.amount)}</span>
                      </div>
                      {pendingPayment.vaNumber ? (
                        <div className="rounded-input border border-line bg-surface p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{t("checkout.va")}</p>
                          <p className="mt-1 font-mono text-xs text-fg">{pendingPayment.vaNumber}</p>
                        </div>
                      ) : null}
                      {pendingPayment.qrString ? (
                        <div className="rounded-input border border-line bg-surface p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{t("checkout.qris")}</p>
                          <p className="mt-1 break-all font-mono text-[10px] text-fg">{pendingPayment.qrString}</p>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5 text-[11px] text-warning">
                        <Clock3 className="h-3.5 w-3.5" />
                        {t("orders.expiresIn", { minutes: remaining })}
                      </div>
                    </div>
                    {pendingPayment.provider === "fake" ? (
                      <>
                        <Button
                          className="mt-3 w-full"
                          size="sm"
                          onClick={handleSimulate}
                          disabled={simulate.isPending}
                        >
                          {simulate.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          {t("orders.simulatePayment")}
                        </Button>
                        <p className="mt-2 text-center text-[10px] text-faint">
                          {t("orders.simulatePaymentHint")}
                        </p>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted">{t("bookings.completedBody")}</p>
                    {paymentExpired ? (
                      <p className="mt-2 rounded-input border border-warning/25 bg-warning/5 p-2 text-[11px] text-warning">
                        {t("bookings.paymentExpired")}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Button size="sm" onClick={() => handlePay("qris")} disabled={pay.isPending}>
                        {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        {t("bookings.payOnline")}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handlePay("cash")} disabled={pay.isPending}>
                        <Clock3 className="h-4 w-4" /> {t("bookings.payCash")}
                      </Button>
                    </div>
                    <p className="mt-2 text-[10px] text-faint">{t("bookings.cashNote")}</p>
                  </>
                )}
              </div>
            ) : null}
          </Card>

          {booking.status === "paid" ? (
            <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-heading text-base font-semibold text-fg">{t("bookings.reviewTitle")}</h2>
                <p className="mt-1 text-xs text-muted">{t("bookings.reviewBody")}</p>
              </div>
              {booking.reviewId ? (
                <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> {t("bookings.reviewed")}</Badge>
              ) : (
                <Button size="sm" onClick={() => setReviewOpen(true)}>
                  <Star className="h-4 w-4" /> {t("bookings.reviewService")}
                </Button>
              )}
            </Card>
          ) : null}

          {booking.mechanicNote || booking.photos.length > 0 ? (
            <Card className="p-5">
              <h2 className="font-heading text-base font-semibold text-fg">{t("bookings.photosNote")}</h2>
              {booking.mechanicNote ? (
                <div className="mt-3 rounded-input border border-line bg-surface2/50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{t("bookings.mechanicNote")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{booking.mechanicNote}</p>
                </div>
              ) : null}
              {booking.photos.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {booking.photos.map((photo, index) => (
                    <ImageWithFallback
                      key={`${photo}-${index}`}
                      src={photo}
                      alt={`${t("bookings.photos")} ${index + 1}`}
                      className="h-28 rounded-input"
                      sizes="(max-width: 768px) 50vw, 200px"
                    />
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("bookings.vehicle")}</h2>
            <p className="mt-2 text-sm text-fg">{booking.vehicleLabel}</p>
            <p className="mt-0.5 text-xs text-muted">{booking.plateNumber}</p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("bookings.odometerIn")}</span>
                <span className="text-fg">{booking.odometerIn.toLocaleString("id-ID")} km</span>
              </div>
              {booking.odometerOut ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("bookings.odometerOut")}</span>
                  <span className="text-fg">{booking.odometerOut.toLocaleString("id-ID")} km</span>
                </div>
              ) : null}
              {booking.mechanicNames.length > 0 ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("bookings.mechanic")}</span>
                  <span className="text-right text-fg">{booking.mechanicNames.join(", ")}</span>
                </div>
              ) : null}
            </div>
            <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
              <Link href={`/vehicles/${booking.vehicleId}`}>{t("bookings.viewVehicle")}</Link>
            </Button>
          </Card>

          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("bookings.complaint")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{booking.complaint}</p>
            {booking.customerNote ? (
              <p className="mt-2 text-[11px] text-faint">{booking.customerNote}</p>
            ) : null}
            {booking.cancelReason ? (
              <p className="mt-3 rounded-input border border-danger/25 bg-danger/5 p-2 text-[11px] text-danger">
                {booking.cancelReason}
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <p className="text-xs text-muted">{t("bookings.cancellationPolicy")}</p>
            {!canCancel && ["requested", "confirmed"].includes(booking.status) ? (
              <p className="mt-2 text-[11px] text-warning">{t("bookings.cancellationBlocked")}</p>
            ) : null}
          </Card>
        </aside>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bookings.approveEstimate")}</DialogTitle>
            <DialogDescription>{t("bookings.approveConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setApproveOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={approve.isPending}
              onClick={async () => {
                try {
                  await approve.mutateAsync(booking.id);
                  setApproveOpen(false);
                  toast.success(t("toasts.estimateApproved"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t("bookings.approveEstimate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bookings.rejectEstimate")}</DialogTitle>
            <DialogDescription>{t("bookings.rejectConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              disabled={reject.isPending}
              onClick={async () => {
                try {
                  await reject.mutateAsync(booking.id);
                  setRejectOpen(false);
                  toast.success(t("toasts.estimateRejected"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {t("bookings.rejectEstimate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bookings.cancelBooking")}</DialogTitle>
            <DialogDescription>{t("bookings.cancelConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={handleCancel} disabled={cancel.isPending}>
              {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {t("bookings.cancelBooking")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        target="workshop"
        serviceOrderId={booking.id}
        onSubmitted={() => setReviewOpen(false)}
      />
    </div>
  );
}

function buildTimeline(booking: ServiceOrder, t: ReturnType<typeof useTranslations>): TimelineItem[] {
  const done = (condition: boolean, current: boolean): TimelineItem["state"] =>
    condition ? "done" : current ? "current" : "pending";

  const items: TimelineItem[] = [
    {
      key: "requested",
      label: t("bookings.requested"),
      date: formatDateTime(booking.createdAt),
      state: "done",
    },
  ];

  if (["declined", "cancelled", "no_show"].includes(booking.status)) {
    items.push({
      key: "terminal",
      label:
        booking.status === "declined"
          ? t("bookings.declined")
          : booking.status === "cancelled"
            ? t("bookings.cancelled")
            : t("bookings.noShow"),
      date: booking.completedAt ?? booking.createdAt,
      state: "failed",
    });
    return items;
  }

  items.push({
    key: "confirmed",
    label: t("bookings.confirmed"),
    date: booking.status !== "requested" ? formatDateTime(booking.scheduledAt) : undefined,
    state: done(booking.status !== "requested", booking.status === "requested"),
  });
  items.push({
    key: "started",
    label: t("bookings.started"),
    date: booking.startedAt ? formatDateTime(booking.startedAt) : undefined,
    state: done(Boolean(booking.startedAt), booking.status === "confirmed"),
  });
  items.push({
    key: "completed",
    label: t("bookings.completed"),
    date: booking.completedAt ? formatDateTime(booking.completedAt) : undefined,
    state: done(Boolean(booking.completedAt), ["in_progress", "awaiting_approval"].includes(booking.status)),
  });
  items.push({
    key: "paid",
    label: t("bookings.paid"),
    date: booking.paidAt ? formatDateTime(booking.paidAt) : undefined,
    state: done(Boolean(booking.paidAt), booking.status === "completed"),
  });
  return items;
}

function paymentMethodLabel(
  method: PaymentMethod,
  t: ReturnType<typeof useTranslations>,
) {
  if (method === "va") return t("checkout.va");
  if (method === "bank_transfer") return t("checkout.bank_transfer");
  if (method === "qris") return t("checkout.qris");
  return t("bookings.payCash");
}

function BookingStatusBanner({ booking }: { booking: ServiceOrder }) {
  const t = useTranslations();
  const config: Record<string, { title: string; body: string; tone: string }> = {
    requested: { title: t("bookings.requested"), body: t("bookings.requestedBody"), tone: "border-warning/25 bg-warning/5 text-warning" },
    confirmed: { title: t("bookings.confirmed"), body: t("bookings.confirmedBody"), tone: "border-accent/25 bg-accent/5 text-accent" },
    in_progress: { title: t("bookings.started"), body: t("bookings.startedBody"), tone: "border-lime/25 bg-lime/5 text-lime" },
    awaiting_approval: { title: t("bookings.awaitingApproval"), body: t("bookings.awaitingApprovalBody"), tone: "border-warning/25 bg-warning/5 text-warning" },
    completed: { title: t("bookings.completed"), body: t("bookings.completedBody"), tone: "border-success/25 bg-success/5 text-success" },
    paid: { title: t("bookings.paid"), body: t("bookings.paidBody"), tone: "border-success/25 bg-success/5 text-success" },
    declined: { title: t("bookings.declined"), body: t("bookings.declinedBody"), tone: "border-danger/25 bg-danger/5 text-danger" },
    cancelled: { title: t("bookings.cancelled"), body: t("bookings.cancelledBody"), tone: "border-danger/25 bg-danger/5 text-danger" },
    no_show: { title: t("bookings.noShow"), body: t("bookings.noShowBody"), tone: "border-danger/25 bg-danger/5 text-danger" },
  };
  const item = config[booking.status];
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
