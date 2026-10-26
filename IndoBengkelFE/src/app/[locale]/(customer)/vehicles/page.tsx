"use client";

import { Bike, Car, ChevronRight, Gauge, Plus, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { VehicleDialog } from "@/components/domain/vehicle-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useVehicles } from "@/lib/api/hooks";
import type { Vehicle } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

export default function VehiclesPage() {
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  const vehiclesQuery = useVehicles(Boolean(user));
  const [dialogOpen, setDialogOpen] = useState(false);

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <Wrench className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.signInToContinue")}</p>
        <Button asChild className="mt-4">
          <Link href="/auth/login?returnTo=/vehicles">{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (vehiclesQuery.isLoading) return <PageLoading />;
  if (vehiclesQuery.isError) return <ErrorState onRetry={() => vehiclesQuery.refetch()} />;

  const vehicles = vehiclesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("nav.garage")}</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("vehicles.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("vehicles.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t("vehicles.addVehicle")}
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t("vehicles.empty")}
          description={t("vehicles.emptyBody")}
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t("vehicles.addVehicle")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}

      <VehicleDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const t = useTranslations();
  const Icon = vehicle.type === "motor" ? Bike : Car;

  return (
    <Card className="group overflow-hidden">
      <div className="relative h-36">
        <ImageWithFallback
          src={vehicle.photoUrl}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className="h-full w-full"
          imageClassName="transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge variant="default" className="bg-black/45 text-white backdrop-blur">
            <Icon className="h-3 w-3" />
            {vehicle.type === "motor" ? t("vehicles.motor") : t("vehicles.mobil")}
          </Badge>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="font-heading text-base font-semibold text-white">
            {vehicle.brand} {vehicle.model}
          </p>
          <p className="text-[11px] text-white/70">{vehicle.year} · {vehicle.plateNumber}</p>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Gauge className="h-3.5 w-3.5 text-accent" />
            {vehicle.odometerKm.toLocaleString("id-ID")} km
          </span>
          <Badge variant="outline">{vehicle.color || "—"}</Badge>
        </div>
        <div className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-faint">{t("vehicles.lastService")}</span>
            <span className="text-muted">
              {vehicle.lastServiceAt ? formatDate(vehicle.lastServiceAt) : t("vehicles.noHistory")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-faint">{t("vehicles.lastWorkshop")}</span>
            <span className="truncate text-right text-muted">{vehicle.lastWorkshopName ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-faint">{t("vehicles.reminder")}</span>
            <span className="text-muted">
              {vehicle.reminderMonths} {t("vehicles.monthsShort")} / {vehicle.reminderKm.toLocaleString("id-ID")} km
            </span>
          </div>
        </div>
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <Button asChild variant="secondary" size="sm" className="flex-1">
            <Link href={`/vehicles/${vehicle.id}`}>
              {t("vehicles.viewDetails")} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" className="flex-1">
            <Link href="/workshops">{t("vehicles.bookService")}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
