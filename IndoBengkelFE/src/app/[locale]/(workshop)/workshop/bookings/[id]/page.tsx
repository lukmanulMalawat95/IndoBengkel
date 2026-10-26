"use client";

import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  Plus,
  ShieldAlert,
  Trash2,
  TrendingUp,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Timeline, type TimelineItem } from "@/components/domain/timeline";
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
import { MultiImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import {
  useCompleteService,
  useConfirmBooking,
  useDeclineBooking,
  useMarkCashPaid,
  useMarkNoShow,
  useMechanics,
  useServiceOrder,
  useStartService,
  useWorkshopServices,
} from "@/lib/api/hooks";
import type { Service, ServiceOrder, ServiceOrderItem } from "@/lib/api/types";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/format";
import { cn, uid } from "@/lib/utils";

type DraftItem = {
  key: string;
  kind: "labor" | "part";
  name: string;
  qty: number;
  unitPrice: number;
};

export default function WorkshopBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const locale = useLocale();
  const bookingQuery = useServiceOrder(id);
  const mechanicsQuery = useMechanics();
  const catalogQuery = useWorkshopServices();
  const confirmBooking = useConfirmBooking();
  const declineBooking = useDeclineBooking();
  const startService = useStartService();
  const completeService = useCompleteService();
  const markCashPaid = useMarkCashPaid();
  const markNoShow = useMarkNoShow();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [noShowOpen, setNoShowOpen] = useState(false);

  const [estimate, setEstimate] = useState("");
  const [reason, setReason] = useState("");
  const [odometerIn, setOdometerIn] = useState("");
  const [mechanicIds, setMechanicIds] = useState<string[]>([]);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [mechanicNote, setMechanicNote] = useState("");

  const booking = bookingQuery.data;
  const mechanics = (mechanicsQuery.data ?? []).filter((mechanic) => mechanic.isActive);
  const catalog = (catalogQuery.data ?? []).filter((service) => service.isActive);

  const draftTotal = useMemo(
    () => items.reduce((total, item) => total + item.qty * item.unitPrice, 0),
    [items],
  );
  const needsApproval = booking
    ? draftTotal > booking.estimatedTotal * 1.5 && draftTotal > 0
    : false;

  if (bookingQuery.isLoading) return <PageLoading />;
  if (bookingQuery.isError || !booking) {
    return <ErrorState title={t("console.serviceOrderNotFound")} onRetry={() => bookingQuery.refetch()} />;
  }

  const openStart = () => {
    setOdometerIn(String(booking.odometerIn || 0));
    setMechanicIds(booking.mechanicIds);
    setStartOpen(true);
  };

  const openComplete = () => {
    setItems(
      booking.items.map((item) => ({
        key: uid("item"),
        kind: item.kind,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
    );
    setPhotos(booking.photos);
    setMechanicNote(booking.mechanicNote ?? "");
    setCompleteOpen(true);
  };

  const toggleCatalogService = (service: Service) => {
    setItems((current) => {
      const exists = current.some(
        (item) => item.name.toLowerCase() === service.name.toLowerCase(),
      );
      if (exists) {
        return current.filter((item) => item.name.toLowerCase() !== service.name.toLowerCase());
      }
      return [
        ...current,
        {
          key: uid("item"),
          kind: service.kind,
          name: service.name,
          qty: 1,
          unitPrice: service.price,
        },
      ];
    });
  };

  const submitComplete = async () => {
    const mapped: ServiceOrderItem[] = items
      .filter((item) => item.name.trim() && item.qty > 0)
      .map((item) => ({
        id: uid("soi"),
        kind: item.kind,
        name: item.name.trim(),
        qty: item.qty,
        unitPrice: item.unitPrice,
        subtotal: item.qty * item.unitPrice,
      }));
    if (mapped.length === 0 || draftTotal <= 0) {
      toast.error(t("validation.required"));
      return;
    }
    try {
      await completeService.mutateAsync({
        id: booking.id,
        items: mapped,
        photos,
        mechanicNote: mechanicNote.trim(),
        finalTotal: draftTotal,
      });
      setCompleteOpen(false);
      toast.success(t("toasts.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  return (
    <div className="space-y-5">
      <Link
        href="/workshop/bookings"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("console.backToBookings")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="service" status={booking.status} />
            <span className="font-mono text-xs text-muted">{booking.code}</span>
          </div>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {booking.customerName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(booking.scheduledAt, locale as "en" | "id")} · {booking.vehicleLabel} ·{" "}
            {booking.plateNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/workshop/chat">
              <MessageSquare className="h-4 w-4" /> {t("console.chat")}
            </Link>
          </Button>
          {booking.status === "requested" ? (
            <>
              <Button size="sm" onClick={() => { setEstimate(String(booking.estimatedTotal)); setConfirmOpen(true); }}>
                <CheckCircle2 className="h-4 w-4" /> {t("console.confirm")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDeclineOpen(true)}>
                <XCircle className="h-4 w-4" /> {t("console.decline")}
              </Button>
            </>
          ) : null}
          {booking.status === "confirmed" ? (
            <>
              <Button size="sm" onClick={openStart}>
                <Wrench className="h-4 w-4" /> {t("console.start")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNoShowOpen(true)}>
                {t("console.noShow")}
              </Button>
            </>
          ) : null}
          {booking.status === "in_progress" ? (
            <Button size="sm" onClick={openComplete}>
              <CheckCircle2 className="h-4 w-4" /> {t("console.finish")}
            </Button>
          ) : null}
          {booking.status === "completed" ? (
            <Button size="sm" onClick={() => setCashOpen(true)}>
              <CheckCircle2 className="h-4 w-4" /> {t("console.cashPaid")}
            </Button>
          ) : null}
        </div>
      </div>

      {booking.status === "awaiting_approval" ? (
        <div className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning/5 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-fg">{t("bookings.estimateApprovalTitle")}</p>
            <p className="mt-0.5 text-xs text-muted">{t("console.awaitingApprovalBody")}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("console.bookingDetail")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Info label={t("console.customer")} value={booking.customerName} />
              <Info label={t("common.phone")} value={booking.customerPhone} />
              <Info label={t("console.vehicle")} value={`${booking.vehicleLabel} · ${booking.plateNumber}`} />
              <Info
                label={t("console.schedule")}
                value={`${formatDateTime(booking.scheduledAt, locale as "en" | "id")} (${formatTime(booking.scheduledAt, locale as "en" | "id")})`}
              />
              <Info label={t("console.odometer")} value={`${booking.odometerIn.toLocaleString("id-ID")} km`} />
              <Info label={t("bookings.odometerOut")} value={booking.odometerOut ? `${booking.odometerOut.toLocaleString("id-ID")} km` : "—"} />
              <div className="sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{t("console.complaint")}</p>
                <p className="mt-1 rounded-input border border-line bg-surface2/40 p-3 text-xs leading-relaxed text-muted">
                  {booking.complaint}
                </p>
                {booking.customerNote ? (
                  <p className="mt-2 text-[11px] text-faint">{booking.customerNote}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{t("console.invoice")}</CardTitle>
              {booking.finalTotal ? (
                <Badge variant={booking.status === "awaiting_approval" ? "warning" : "success"}>
                  {booking.status === "awaiting_approval" ? t("bookings.awaitingApproval") : t("console.finalTotal")}
                </Badge>
              ) : (
                <Badge variant="outline">{t("console.estimate")}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {booking.items.length === 0 ? (
                <p className="text-xs text-muted">{t("console.noInvoiceItems")}</p>
              ) : (
                <div className="space-y-2">
                  {booking.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="text-fg">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-faint">
                          {item.kind === "labor" ? t("console.labor") : t("console.part")} · {item.qty} ×{" "}
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium text-fg">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("console.estimate")}</span>
                  <span className="text-fg">
                    {booking.estimatedTotal === 0
                      ? t("booking.quoteAfter")
                      : formatCurrency(booking.estimatedTotal)}
                  </span>
                </div>
                {booking.finalTotal ? (
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">{t("console.finalTotal")}</span>
                    <span className="font-heading font-semibold text-fg">
                      {formatCurrency(booking.finalTotal)}
                    </span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {booking.status === "paid" ? (
            <Card className="border-success/25 bg-success/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                <CheckCircle2 className="h-4 w-4 text-success" /> {t("bookings.paid")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {booking.paymentMethod === "cash" ? t("bookings.payCash") : t("bookings.payOnline")} ·{" "}
                {booking.paidAt ? formatDateTime(booking.paidAt, locale as "en" | "id") : ""}
              </p>
            </Card>
          ) : null}

          {booking.mechanicNote || booking.photos.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("console.completeServiceTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                {booking.mechanicNote ? (
                  <p className="rounded-input border border-line bg-surface2/40 p-3 text-xs leading-relaxed text-muted">
                    {booking.mechanicNote}
                  </p>
                ) : null}
                {booking.photos.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {booking.photos.map((photo, index) => (
                      <ImageWithFallback
                        key={`${photo}-${index}`}
                        src={photo}
                        alt={`${t("console.photos")} ${index + 1}`}
                        className="h-28 rounded-input"
                        sizes="(max-width: 768px) 50vw, 200px"
                      />
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t("bookings.timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline items={buildTimeline(booking, t)} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs text-muted">
              <UserRound className="h-4 w-4 text-accent" /> {t("console.customer")}
            </p>
            <p className="mt-2 text-sm font-medium text-fg">{booking.customerName}</p>
            <p className="mt-0.5 text-xs text-muted">{booking.customerPhone}</p>
            <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
              <Link href="/workshop/chat">
                <MessageSquare className="h-4 w-4" /> {t("console.chat")}
              </Link>
            </Button>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs text-muted">
              <Wrench className="h-4 w-4 text-accent" /> {t("console.mechanic")}
            </p>
            {booking.mechanicNames.length === 0 ? (
              <p className="mt-2 text-xs text-faint">{t("console.selectMechanic")}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {booking.mechanicNames.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-xs text-fg">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {name}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs text-muted">
              <TrendingUp className="h-4 w-4 text-accent" /> {t("console.finalTotal")}
            </p>
            <p className="mt-2 font-heading text-xl font-semibold text-fg">
              {formatCurrency(booking.finalTotal ?? booking.estimatedTotal)}
            </p>
            <p className="mt-1 text-[11px] text-faint">
              {t("console.estimate")} · {formatCurrency(booking.estimatedTotal)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs text-muted">
              <CalendarClock className="h-4 w-4 text-accent" /> {t("console.schedule")}
            </p>
            <p className="mt-2 text-xs text-fg">
              {formatDateTime(booking.scheduledAt, locale as "en" | "id")}
            </p>
            <p className="mt-1 text-[11px] text-faint">
              <Clock3 className="mr-1 inline h-3 w-3" />
              {formatTime(booking.scheduledAt, locale as "en" | "id")}
            </p>
          </Card>
        </aside>
      </div>

      {/* Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.confirmBookingTitle")}</DialogTitle>
            <DialogDescription>{t("console.confirmBookingBody")}</DialogDescription>
          </DialogHeader>
          <Field label={t("console.estimate")} hint="IDR">
            <Input type="number" min={0} value={estimate} onChange={(event) => setEstimate(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={confirmBooking.isPending || !estimate}
              onClick={async () => {
                try {
                  await confirmBooking.mutateAsync({ id: booking.id, estimatedTotal: Number(estimate) });
                  setConfirmOpen(false);
                  toast.success(t("toasts.saved"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {confirmBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t("console.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.declineBookingTitle")}</DialogTitle>
            <DialogDescription>{t("console.declineBookingBody")}</DialogDescription>
          </DialogHeader>
          <Field label={t("console.reason")}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeclineOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              disabled={declineBooking.isPending || reason.trim().length < 3}
              onClick={async () => {
                try {
                  await declineBooking.mutateAsync({ id: booking.id, reason: reason.trim() });
                  setDeclineOpen(false);
                  toast.success(t("toasts.saved"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {declineBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {t("console.decline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start service */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("console.startServiceTitle")}</DialogTitle>
            <DialogDescription>{t("console.startServiceBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={t("console.odometer")}>
              <Input
                type="number"
                min={booking.odometerIn}
                value={odometerIn}
                onChange={(event) => setOdometerIn(event.target.value)}
              />
            </Field>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
                {t("console.selectMechanic")}
              </p>
              {mechanics.length === 0 ? (
                <p className="text-xs text-danger">{t("console.noMechanicsBody")}</p>
              ) : (
                <div className="space-y-2">
                  {mechanics.map((mechanic) => {
                    const checked = mechanicIds.includes(mechanic.id);
                    return (
                      <button
                        key={mechanic.id}
                        type="button"
                        onClick={() =>
                          setMechanicIds((current) =>
                            checked ? current.filter((value) => value !== mechanic.id) : [...current, mechanic.id],
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-input border p-3 text-left text-xs transition-colors",
                          checked ? "border-accent/40 bg-accent/5" : "border-line bg-surface hover:border-lineStrong",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
                            checked ? "border-accent bg-accent text-accentInk" : "border-line",
                          )}
                        >
                          {checked ? <CheckCircle2 className="h-3 w-3" /> : null}
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium text-fg">{mechanic.name}</span>
                          <span className="text-[10px] text-muted">
                            {mechanic.skills.join(", ") || t("common.general")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setStartOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={startService.isPending || mechanicIds.length === 0 || !odometerIn}
              onClick={async () => {
                try {
                  await startService.mutateAsync({
                    id: booking.id,
                    odometerIn: Number(odometerIn),
                    mechanicIds,
                  });
                  setStartOpen(false);
                  toast.success(t("toasts.saved"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {startService.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              {t("console.start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete service */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("console.completeServiceTitle")}</DialogTitle>
            <DialogDescription>{t("console.completeServiceBody")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {booking.estimatedTotal === 0 ? (
              <div className="flex items-start gap-2 rounded-input border border-warning/25 bg-warning/5 p-3 text-[11px] leading-relaxed text-muted">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {t("console.freeInspectionHint")}
              </div>
            ) : null}
            <div className="rounded-input border border-line p-3">
              <p className="text-xs font-medium text-fg">{t("console.catalogTitle")}</p>
              <p className="mt-0.5 text-[11px] text-muted">{t("console.catalogHint")}</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {catalog.map((service) => {
                  const checked = items.some(
                    (item) => item.name.toLowerCase() === service.name.toLowerCase(),
                  );
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleCatalogService(service)}
                      className={cn(
                        "flex items-center gap-2 rounded-input border px-2.5 py-2 text-left text-[11px] transition-colors",
                        checked
                          ? "border-accent/50 bg-accent/5 text-fg"
                          : "border-line bg-surface2/30 text-muted hover:text-fg",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked ? "border-accent bg-accent text-accentInk" : "border-line",
                        )}
                      >
                        {checked ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{service.name}</span>
                      <span className="shrink-0 font-medium text-fg">
                        {service.price === 0 ? t("booking.free") : formatCurrency(service.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.key} className="grid grid-cols-12 gap-2 rounded-input border border-line bg-surface2/30 p-2">
                  <Select
                    value={item.kind}
                    className="col-span-12 h-9 text-xs sm:col-span-2"
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? { ...value, kind: event.target.value as DraftItem["kind"] } : value,
                        ),
                      )
                    }
                  >
                    <option value="labor">{t("console.labor")}</option>
                    <option value="part">{t("console.part")}</option>
                  </Select>
                  <Input
                    className="col-span-12 h-9 text-xs sm:col-span-4"
                    placeholder={t("console.itemName")}
                    value={item.name}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? { ...value, name: event.target.value } : value,
                        ),
                      )
                    }
                  />
                  <Input
                    className="col-span-3 h-9 text-xs sm:col-span-1"
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? { ...value, qty: Number(event.target.value) } : value,
                        ),
                      )
                    }
                  />
                  <Input
                    className="col-span-6 h-9 text-xs sm:col-span-3"
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? { ...value, unitPrice: Number(event.target.value) } : value,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="col-span-3 flex items-center justify-center rounded-input border border-line text-faint hover:text-danger sm:col-span-2"
                    onClick={() => setItems((current) => current.filter((value) => value.key !== item.key))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setItems((current) => [
                    ...current,
                    { key: uid("item"), kind: "part", name: "", qty: 1, unitPrice: 0 },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> {t("console.addItem")}
              </Button>
            </div>

            <Field label={t("console.finalTotal")} hint={formatCurrency(draftTotal)}>
              <div
                className={cn(
                  "rounded-input border p-3 text-sm",
                  needsApproval ? "border-warning/40 bg-warning/5 text-warning" : "border-line bg-surface2/40 text-fg",
                )}
              >
                <span className="font-heading text-lg font-semibold">{formatCurrency(draftTotal)}</span>
                {needsApproval ? (
                  <span className="mt-1 flex items-center gap-1.5 text-[11px]">
                    <ShieldAlert className="h-3.5 w-3.5" />{" "}
                    {booking.estimatedTotal === 0
                      ? t("console.approvalWarningFree")
                      : t("console.approvalWarning")}
                  </span>
                ) : null}
              </div>
            </Field>

            <Field label={t("console.mechanicNote")}>
              <Textarea value={mechanicNote} onChange={(event) => setMechanicNote(event.target.value)} rows={3} />
            </Field>

            <Field label={t("console.photos")} hint={t("console.photosHint")}>
              <MultiImageUpload values={photos} onChange={setPhotos} max={4} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCompleteOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={completeService.isPending || draftTotal <= 0}
              onClick={submitComplete}
            >
              {completeService.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t("console.finish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash paid */}
      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.cashPaid")}</DialogTitle>
            <DialogDescription>{t("console.cashPaidConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCashOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={markCashPaid.isPending}
              onClick={async () => {
                try {
                  await markCashPaid.mutateAsync(booking.id);
                  setCashOpen(false);
                  toast.success(t("toasts.saved"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {markCashPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t("console.cashPaid")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-show */}
      <Dialog open={noShowOpen} onOpenChange={setNoShowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.noShowConfirm")}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNoShowOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              disabled={markNoShow.isPending}
              onClick={async () => {
                try {
                  await markNoShow.mutateAsync(booking.id);
                  setNoShowOpen(false);
                  toast.success(t("toasts.saved"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {t("console.noShow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-input border border-line bg-surface2/40 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className="mt-1 text-xs text-fg">{value}</p>
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
