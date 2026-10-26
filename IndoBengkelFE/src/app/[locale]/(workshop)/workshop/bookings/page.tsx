"use client";

import { ArrowRight, CalendarClock, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { useWorkshopBookings, useWorkshopDashboard } from "@/lib/api/hooks";
import type { ServiceOrder } from "@/lib/api/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const filters = [
  "requested",
  "confirmed",
  "in_progress",
  "awaiting_approval",
  "completed",
  "paid",
  "all",
] as const;

export default function WorkshopBookingsPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<(typeof filters)[number]>("requested");
  const bookingsQuery = useWorkshopBookings(status === "all" ? undefined : status);
  const dashboardQuery = useWorkshopDashboard();

  if (bookingsQuery.isLoading) return <PageLoading />;
  if (bookingsQuery.isError) return <ErrorState onRetry={() => bookingsQuery.refetch()} />;

  const bookings = bookingsQuery.data ?? [];
  const requestedCount = dashboardQuery.data?.todayBookings.filter(
    (booking) => booking.status === "requested",
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.bookings")}
        title={t("console.bookings")}
        description={t("console.bookingsSubtitle")}
        actions={
          requestedCount ? (
            <Badge variant="warning">{requestedCount} {t("console.requested")}</Badge>
          ) : null
        }
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
            {filter === "all" ? t("console.all") : t(`status.service.${filter}`)}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t("console.noActive")}
          description={t("console.noActiveBody")}
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {bookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </Card>
      )}
    </div>
  );
}

function BookingRow({ booking }: { booking: ServiceOrder }) {
  const t = useTranslations();
  return (
    <Link
      href={`/workshop/bookings/${booking.id}`}
      className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface2/50 lg:flex-row lg:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full chip-accent">
          <Wrench className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-fg">{booking.customerName}</p>
            <StatusBadge kind="service" status={booking.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
            <span className="font-mono">{booking.code}</span> · {booking.vehicleLabel} · {booking.plateNumber}
          </p>
          <p className="mt-1 line-clamp-1 text-[11px] text-faint">{booking.complaint}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:justify-end">
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.1em] text-faint">
            {booking.finalTotal ? t("console.finalTotal") : t("console.estimate")}
          </p>
          <p className="font-heading text-sm font-semibold text-fg">
            {formatCurrency(booking.finalTotal ?? booking.estimatedTotal)}
          </p>
          <p className="mt-0.5 text-[10px] text-faint">{formatDateTime(booking.scheduledAt)}</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <span>
            {t("common.manage")} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Button>
      </div>
    </Link>
  );
}
