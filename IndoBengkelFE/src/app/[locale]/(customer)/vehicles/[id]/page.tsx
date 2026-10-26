"use client";

import {
  ArrowLeft,
  Bike,
  CalendarClock,
  Car,
  Gauge,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { VehicleDialog } from "@/components/domain/vehicle-dialog";
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
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageLoading } from "@/components/ui/page-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useDeleteVehicle, useServiceOrders, useVehicle } from "@/lib/api/hooks";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  const vehicleQuery = useVehicle(id, Boolean(user));
  const bookingsQuery = useServiceOrders(Boolean(user));
  const deleteVehicle = useDeleteVehicle();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <Wrench className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <Button asChild className="mt-4">
          <Link href={`/auth/login?returnTo=/vehicles/${id}`}>{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (vehicleQuery.isLoading) return <PageLoading />;
  if (vehicleQuery.isError || !vehicleQuery.data) {
    return <ErrorState title={t("vehicles.vehicleNotFound")} onRetry={() => vehicleQuery.refetch()} />;
  }

  const vehicle = vehicleQuery.data;
  const history = (bookingsQuery.data ?? [])
    .filter((booking) => booking.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastVisit = history[0];
  const canDelete = history.length === 0;
  const Icon = vehicle.type === "motor" ? Bike : Car;

  const handleDelete = async () => {
    try {
      await deleteVehicle.mutateAsync(vehicle.id);
      setDeleteOpen(false);
      toast.success(t("toasts.deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("vehicles.backToVehicles")}
      </Link>

      <section className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-52">
            <ImageWithFallback
              src={vehicle.photoUrl}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="h-full min-h-52 w-full"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <div className="absolute left-4 top-4">
              <Badge variant="default" className="bg-black/50 text-white backdrop-blur">
                <Icon className="h-3 w-3" />
                {vehicle.type === "motor" ? t("vehicles.motor") : t("vehicles.mobil")}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col justify-between p-5 sm:p-6">
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                {vehicle.brand} {vehicle.model}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {vehicle.year} · {vehicle.color} · {vehicle.plateNumber}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label={t("vehicles.lastOdometer")} value={`${vehicle.odometerKm.toLocaleString("id-ID")} km`} icon={Gauge} />
                <Stat label={t("vehicles.totalServices")} value={String(history.filter((item) => ["completed", "paid"].includes(item.status)).length)} icon={Wrench} />
                <Stat label={t("vehicles.lastVisit")} value={lastVisit ? formatDate(lastVisit.scheduledAt) : "—"} icon={CalendarClock} />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/workshops">
                  <CalendarClock className="h-4 w-4" /> {t("vehicles.bookService")}
                </Link>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> {t("vehicles.edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!canDelete}
                onClick={() => setDeleteOpen(true)}
                title={!canDelete ? t("vehicles.deleteBlocked") : undefined}
              >
                <Trash2 className="h-4 w-4" /> {t("vehicles.delete")}
              </Button>
            </div>
            {!canDelete ? <p className="mt-2 text-[11px] text-faint">{t("vehicles.deleteBlocked")}</p> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Wrench className="h-4 w-4 text-accent" />
            <h2 className="font-heading text-base font-semibold text-fg">{t("vehicles.historyTitle")}</h2>
            <Badge variant="outline" className="ml-auto">{history.length}</Badge>
          </div>
          {history.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Wrench}
                title={t("vehicles.noHistory")}
                description={t("vehicles.historyEmpty")}
                action={
                  <Button asChild size="sm">
                    <Link href="/workshops">{t("vehicles.bookService")}</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {history.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/bookings/${booking.id}`}
                  className="flex flex-col gap-2 p-4 transition-colors hover:bg-surface2/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="service" status={booking.status} />
                      <span className="font-mono text-[10px] text-faint">{booking.code}</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-fg">{booking.workshopName}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatDateTime(booking.scheduledAt)} · {booking.complaint}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <p className="text-sm font-medium text-fg">
                      {formatCurrency(booking.finalTotal ?? booking.estimatedTotal)}
                    </p>
                    <p className="text-[10px] text-faint">{booking.odometerIn.toLocaleString("id-ID")} km</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("vehicles.reminder")}</h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("vehicles.reminderMonths")}</span>
                <span className="text-fg">{vehicle.reminderMonths}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("vehicles.reminderKm")}</span>
                <span className="text-fg">{vehicle.reminderKm.toLocaleString("id-ID")} km</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("vehicles.lastWorkshop")}</span>
                <span className="text-right text-fg">{vehicle.lastWorkshopName ?? "—"}</span>
              </div>
              {vehicle.lastServiceAt ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted">{t("vehicles.lastService")}</span>
                  <span className="text-fg">{formatDate(vehicle.lastServiceAt)}</span>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-faint">{t("vehicles.reminderHint")}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] leading-relaxed text-muted">{t("vehicles.odometerHint")}</p>
            <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
              <Link href={`/bookings?vehicle=${vehicle.id}`}>
                <Plus className="h-4 w-4" /> {t("vehicles.bookAgain")}
              </Link>
            </Button>
          </Card>
        </aside>
      </div>

      <VehicleDialog open={editOpen} onOpenChange={setEditOpen} vehicle={vehicle} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("vehicles.delete")}</DialogTitle>
            <DialogDescription>{t("vehicles.deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteVehicle.isPending}>
              <Trash2 className="h-4 w-4" /> {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-input border border-line bg-surface2/50 p-2.5">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-faint">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 text-xs font-medium text-fg">{value}</p>
    </div>
  );
}
