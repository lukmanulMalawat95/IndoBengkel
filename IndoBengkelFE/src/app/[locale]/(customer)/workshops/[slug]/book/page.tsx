"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  MapPin,
  Wrench,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { useAvailability, useCreateBooking, useVehicles, useWorkshop } from "@/lib/api/hooks";
import type { ServiceCategory, ServiceOrder } from "@/lib/api/types";
import {
  addDays,
  formatCurrency,
  formatDate,
  formatDuration,
  formatTime,
  toDateInputValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const STEP_KEYS = ["stepVehicle", "stepServices", "stepSchedule", "stepDetails", "stepReview"] as const;

const CATEGORY_ORDER: ServiceCategory[] = [
  "inspection",
  "oil",
  "engine",
  "brakes",
  "electrical",
  "tires",
  "body",
  "other",
];

function BookingContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const workshopQuery = useWorkshop(slug);
  const workshop = workshopQuery.data;
  const vehiclesQuery = useVehicles(Boolean(user));
  const createBooking = useCreateBooking();

  const initialService = searchParams.get("service");
  const [step, setStep] = useState(0);
  const [vehicleId, setVehicleId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(toDateInputValue(addDays(new Date(), 1)));
  const [slot, setSlot] = useState("");
  const [complaint, setComplaint] = useState("");
  const [odometer, setOdometer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ServiceOrder | null>(null);

  const availabilityQuery = useAvailability(workshop?.id ?? "", date, Boolean(workshop));
  const slots = availabilityQuery.data ?? [];
  const vehicles = useMemo(
    () => (vehiclesQuery.data ?? []).filter((vehicle) => vehicle.type === workshop?.workshopType),
    [vehiclesQuery.data, workshop?.workshopType],
  );
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  const selectedServices = useMemo(
    () => workshop?.services.filter((service) => serviceIds.includes(service.id)) ?? [],
    [serviceIds, workshop?.services],
  );
  const estimate = selectedServices.reduce((total, service) => total + service.price, 0);
  const duration = selectedServices.reduce((total, service) => total + service.durationMinutes, 0);
  const groupedServices = useMemo(() => {
    const active = (workshop?.services ?? []).filter((service) => service.isActive);
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: active.filter((service) => service.category === category),
    })).filter((group) => group.items.length > 0);
  }, [workshop?.services]);

  useEffect(() => {
    if (!workshop) return;
    if (initialService && workshop.services.some((service) => service.id === initialService)) {
      setServiceIds((current) => (current.length ? current : [initialService]));
    }
  }, [initialService, workshop]);

  useEffect(() => {
    if (!vehicleId && vehicles[0]) {
      setVehicleId(vehicles[0].id);
      setOdometer(String(vehicles[0].odometerKm));
    }
  }, [vehicleId, vehicles]);

  useEffect(() => {
    if (vehicle) setOdometer(String(vehicle.odometerKm));
  }, [vehicle]);

  useEffect(() => {
    setSlot("");
  }, [date]);

  if (authLoading || workshopQuery.isLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full chip-accent">
          <Wrench className="h-5 w-5" />
        </div>
        <h1 className="mt-4 font-heading text-xl font-semibold text-fg">{t("booking.loginRequired")}</h1>
        <p className="mt-2 text-sm text-muted">{t("booking.loginRequiredBody")}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button asChild>
            <Link href={`/auth/login?returnTo=/workshops/${slug}/book`}>{t("common.login")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/workshops/${slug}`}>{t("common.back")}</Link>
          </Button>
        </div>
      </Card>
    );
  }
  if (workshopQuery.isError || !workshop) {
    return <ErrorState title={t("workshop.workshopNotFound")} onRetry={() => workshopQuery.refetch()} />;
  }

  if (created) {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-fg">{t("booking.bookingRequested")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("booking.bookingRequestedBody")}</p>
        <div className="mt-5 rounded-card border border-line bg-surface2/60 p-4 text-left">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-faint">{t("bookings.code")}</span>
            <span className="font-mono text-fg">{created.code}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-faint">{t("bookings.workshop")}</span>
            <span className="text-fg">{created.workshopName}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-faint">{t("bookings.scheduledAt")}</span>
            <span className="text-fg">{formatDateTimeShort(created.scheduledAt, locale)}</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={`/bookings/${created.id}`}>{t("booking.viewBooking")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/workshops/${workshop.slug}`}>{t("booking.backToWorkshop")}</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const next = () => {
    setError("");
    if (step === 0 && !vehicleId) {
      setError(t("booking.noVehicle"));
      return;
    }
    if (step === 1 && selectedServices.length === 0) {
      setError(t("booking.selectAtLeastOne"));
      return;
    }
    if (step === 2 && !slot) {
      setError(t("booking.slotRequired"));
      return;
    }
    if (step === 3) {
      if (complaint.trim().length < 10) {
        setError(t("booking.complaintMin"));
        return;
      }
      if (!odometer || Number(odometer) < (vehicle?.odometerKm ?? 0)) {
        setError(t("booking.odometerLow"));
        return;
      }
    }
    setStep((value) => Math.min(4, value + 1));
  };

  const submit = async () => {
    setError("");
    try {
      const order = await createBooking.mutateAsync({
        workshopId: workshop.id,
        vehicleId,
        serviceIds,
        scheduledAt: slot,
        complaint: complaint.trim(),
        odometer: Number(odometer),
        customerNote: note.trim() || undefined,
      });
      setCreated(order);
      toast.success(t("toasts.bookingRequested"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("booking.error");
      setError(message);
      toast.error(message);
    }
  };

  const selectedSlot = slots.find((item) => item.iso === slot);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/workshops/${workshop.slug}`} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" /> {workshop.name}
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("booking.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("booking.subtitle")}</p>
        </div>
        <Badge variant="accent">{t("booking.step", { current: step + 1, total: 5 })}</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        {STEP_KEYS.map((key, index) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (index <= step) setStep(index);
            }}
            className={cn(
              "flex items-center gap-2 rounded-input border px-3 py-2 text-left text-[11px] transition-colors",
              index === step
                ? "border-accent/40 bg-accent/10 text-accent"
                : index < step
                  ? "border-line bg-surface text-fg"
                  : "border-line bg-surface/40 text-faint",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                index < step
                  ? "border-accent bg-accent text-accentInk"
                  : index === step
                    ? "border-accent text-accent"
                    : "border-line text-faint",
              )}
            >
              {index < step ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            {t(`booking.${key}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="min-h-80 p-5">
          {step === 0 ? (
            <div>
              <StepTitle title={t("booking.chooseVehicle")} description={t("vehicles.odometerHint")} />
              {vehicles.length === 0 ? (
                <div className="mt-5 rounded-card border border-dashed border-line bg-surface2/40 p-6 text-center">
                  <p className="text-sm font-medium text-fg">{t("booking.noVehicle")}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t("booking.noVehicleBody", { type: workshop.workshopType === "motor" ? t("home.motor") : t("home.mobil") })}
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link href={`/vehicles?type=${workshop.workshopType}`}>{t("booking.addVehicleCta")}</Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {vehicles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVehicleId(item.id)}
                      className={cn(
                        "rounded-card border p-4 text-left transition-colors",
                        item.id === vehicleId
                          ? "border-accent/50 bg-accent/5"
                          : "border-line bg-surface hover:border-lineStrong",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-fg">{item.brand} {item.model}</p>
                          <p className="mt-0.5 text-[11px] text-muted">{item.plateNumber} · {item.year}</p>
                        </div>
                        {item.id === vehicleId ? <CheckCircle2 className="h-4 w-4 text-accent" /> : null}
                      </div>
                      <p className="mt-3 text-[11px] text-faint">
                        {t("vehicles.odometer")}: {item.odometerKm.toLocaleString("id-ID")} km
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <StepTitle title={t("booking.chooseServices")} description={t("booking.servicesHint")} />
              <div className="mt-4 space-y-5">
                {groupedServices.map((group) => (
                  <div key={group.category}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                      {t(`serviceCategories.${group.category}`)}
                    </p>
                    <div className="mt-2 space-y-2.5">
                      {group.items.map((service) => {
                        const checked = serviceIds.includes(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() =>
                              setServiceIds((current) =>
                                checked
                                  ? current.filter((id) => id !== service.id)
                                  : [...current, service.id],
                              )
                            }
                            className={cn(
                              "flex w-full items-start justify-between gap-3 rounded-card border p-4 text-left transition-colors",
                              checked
                                ? "border-accent/50 bg-accent/5"
                                : "border-line bg-surface hover:border-lineStrong",
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-fg">{service.name}</p>
                                <span className="rounded-full border border-line bg-surface2 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-faint">
                                  {t(`serviceKinds.${service.kind}`)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted">{service.description}</p>
                              <p className="mt-1.5 text-[11px] text-faint">
                                <Clock3 className="mr-1 inline h-3 w-3" />{" "}
                                {formatDuration(service.durationMinutes)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-fg">
                                {service.price === 0 ? t("booking.free") : formatCurrency(service.price)}
                              </p>
                              <span
                                className={cn(
                                  "mt-2 flex h-5 w-5 items-center justify-center rounded-full border",
                                  checked ? "border-accent bg-accent text-accentInk" : "border-line",
                                )}
                              >
                                {checked ? <Check className="h-3 w-3" /> : null}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2 rounded-input border border-line bg-surface2/50 p-3 text-[11px] leading-relaxed text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {t("booking.inspectionNote")}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <StepTitle title={t("booking.schedule")} description={t("booking.leadTimeNote")} />
              <div className="mt-4 max-w-xs">
                <Field label={t("booking.date")}>
                  <Input
                    type="date"
                    value={date}
                    min={toDateInputValue(new Date())}
                    max={toDateInputValue(addDays(new Date(), 30))}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-4">
                {availabilityQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" /> {t("common.loading")}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="rounded-card border border-dashed border-line bg-surface2/40 p-5 text-center">
                    <p className="text-sm font-medium text-fg">{t("booking.noSlots")}</p>
                    <p className="mt-1 text-xs text-muted">{t("booking.noSlotsBody")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((item) => (
                      <button
                        key={item.iso}
                        type="button"
                        disabled={!item.available}
                        onClick={() => setSlot(item.iso)}
                        className={cn(
                          "rounded-input border px-2 py-2.5 text-center transition-colors",
                          slot === item.iso
                            ? "border-accent bg-accent/10 text-accent"
                            : item.available
                              ? "border-line bg-surface text-fg hover:border-lineStrong"
                              : "cursor-not-allowed border-line bg-surface2/40 text-faint line-through",
                        )}
                      >
                        <span className="block text-xs font-medium">{item.time}</span>
                        <span className="mt-0.5 block text-[9px] opacity-70">
                          {item.available ? `${item.remaining} ${t("workshop.slot")}` : t("common.closed")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2 rounded-input border border-line bg-surface2/50 p-3 text-[11px] leading-relaxed text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {t("booking.capacityNote")}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <StepTitle title={t("booking.stepDetails")} description={t("booking.odometerHint")} />
              <Field label={t("booking.complaint")} error={error && complaint.trim().length < 10 ? error : undefined}>
                <Textarea
                  value={complaint}
                  onChange={(event) => setComplaint(event.target.value)}
                  placeholder={t("booking.complaintPlaceholder")}
                  rows={4}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("booking.odometer")} hint={`${t("vehicles.lastOdometer")}: ${vehicle?.odometerKm.toLocaleString("id-ID") ?? "—"} km`}>
                  <Input
                    type="number"
                    value={odometer}
                    min={vehicle?.odometerKm ?? 0}
                    onChange={(event) => setOdometer(event.target.value)}
                  />
                </Field>
                <Field label={t("booking.note")} hint={t("common.optional")}>
                  <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("booking.notePlaceholder")}
                  />
                </Field>
              </div>
              <p className="text-[11px] leading-relaxed text-faint">{t("booking.cancellationPolicy")}</p>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <StepTitle title={t("booking.summary")} description={t("booking.capacityNote")} />
              <div className="mt-4 divide-y divide-line rounded-card border border-line">
                <SummaryRow label={t("booking.workshop")} value={workshop.name} />
                <SummaryRow label={t("booking.vehicle")} value={`${vehicle?.brand ?? ""} ${vehicle?.model ?? ""} · ${vehicle?.plateNumber ?? ""}`} />
                <SummaryRow label={t("booking.schedule")} value={selectedSlot ? `${formatDate(slot, locale as "en" | "id")} · ${formatTime(slot, locale as "en" | "id")}` : "—"} />
                <div className="p-3.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{t("booking.selectedServices")}</p>
                  <ul className="mt-2 space-y-1.5">
                    {selectedServices.map((service) => (
                      <li key={service.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted">{service.name}</span>
                        <span className="text-fg">
                          {service.price === 0 ? t("booking.free") : formatCurrency(service.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{t("booking.complaint")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{complaint}</p>
                  {note ? <p className="mt-2 text-[11px] text-faint">{note}</p> : null}
                </div>
              </div>
              <div className="mt-4 rounded-card border border-warning/25 bg-warning/5 p-3.5 text-[11px] leading-relaxed text-muted">
                {t("bookings.estimateNote")}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-line pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (step === 0 ? router.push(`/workshops/${workshop.slug}`) : setStep((value) => value - 1))}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("booking.back")}
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={next}>
                {t("booking.next")} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={createBooking.isPending}>
                {createBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t("booking.confirmBooking")}
              </Button>
            )}
          </div>
        </Card>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-faint">{t("booking.summary")}</p>
            <div className="mt-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full chip-accent">
                <Wrench className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{workshop.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                  <MapPin className="h-3 w-3" /> {workshop.city}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("booking.vehicle")}</span>
                <span className="text-right text-fg">{vehicle ? `${vehicle.brand} ${vehicle.model}` : "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("booking.schedule")}</span>
                <span className="text-right text-fg">{selectedSlot ? `${formatDate(slot, locale as "en" | "id")} · ${selectedSlot.time}` : "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("booking.duration")}</span>
                <span className="text-right text-fg">{duration ? formatDuration(duration) : "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("booking.selectedServices")}</span>
                <span className="text-right text-fg">{selectedServices.length}</span>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <span className="text-xs text-muted">{t("booking.estimatedTotal")}</span>
              <span className="font-heading text-lg font-semibold text-fg">
                {selectedServices.length > 0 && estimate === 0
                  ? t("booking.quoteAfter")
                  : formatCurrency(estimate)}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">{t("bookings.estimateNote")}</p>
          </Card>
          <div className="mt-3 flex items-start gap-2 rounded-card border border-line bg-surface/50 p-3 text-[11px] leading-relaxed text-faint">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            {t("booking.cancellationPolicy")}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-heading text-lg font-semibold tracking-tight text-fg">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 text-xs">
      <span className="text-faint">{label}</span>
      <span className="text-right text-fg">{value}</span>
    </div>
  );
}

function formatDateTimeShort(value: string, locale: string) {
  return `${formatDate(value, locale as "en" | "id")} · ${formatTime(value, locale as "en" | "id")}`;
}

export default function BookingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <BookingContent />
    </Suspense>
  );
}
