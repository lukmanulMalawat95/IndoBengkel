"use client";

import { ArrowRight, CalendarClock, ClipboardList, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageLoading } from "@/components/ui/page-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useServiceOrders } from "@/lib/api/hooks";
import type { ServiceOrder, ServiceOrderStatus } from "@/lib/api/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const filters: (ServiceOrderStatus | "all")[] = [
  "all",
  "requested",
  "confirmed",
  "in_progress",
  "awaiting_approval",
  "completed",
  "paid",
  "cancelled",
  "declined",
  "no_show",
];

export default function BookingsPage() {
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  const bookingsQuery = useServiceOrders(Boolean(user));
  const [status, setStatus] = useState<ServiceOrderStatus | "all">("all");

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <CalendarClock className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.signInToContinue")}</p>
        <Button asChild className="mt-4">
          <Link href="/auth/login?returnTo=/bookings">{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (bookingsQuery.isLoading) return <PageLoading />;
  if (bookingsQuery.isError) return <ErrorState onRetry={() => bookingsQuery.refetch()} />;

  const bookings = (bookingsQuery.data ?? []).filter(
    (booking) => status === "all" || booking.status === status,
  );
  const needsAction = (bookingsQuery.data ?? []).filter(
    (booking) => booking.status === "awaiting_approval",
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("nav.garage")}</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("bookings.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("bookings.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {needsAction > 0 ? (
            <Badge variant="warning">{needsAction} {t("bookings.awaitingApproval")}</Badge>
          ) : null}
          <Button asChild variant="secondary" size="sm">
            <Link href="/workshops">
              <Wrench className="h-4 w-4" /> {t("bookings.findWorkshop")}
            </Link>
          </Button>
        </div>
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
            {filter === "all" ? t("common.all") : t(`status.service.${filter}`)}
          </button>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("bookings.empty")}
          description={t("bookings.emptyBody")}
          action={
            <Button asChild>
              <Link href="/workshops">{t("bookings.findWorkshop")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({ booking }: { booking: ServiceOrder }) {
  const t = useTranslations();
  return (
    <Card className={cn("overflow-hidden", booking.status === "awaiting_approval" ? "border-warning/35" : "")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="service" status={booking.status} />
          <span className="font-mono text-[11px] text-muted">{booking.code}</span>
          {booking.status === "awaiting_approval" ? (
            <Badge variant="warning">{t("bookings.estimateApprovalTitle")}</Badge>
          ) : null}
        </div>
        <span className="text-[11px] text-faint">{formatDateTime(booking.scheduledAt)}</span>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full chip-accent">
            <Wrench className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{booking.workshopName}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {booking.vehicleLabel} · {booking.plateNumber}
            </p>
            <p className="mt-1 line-clamp-1 text-[11px] text-faint">{booking.complaint}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
              {booking.status === "paid" || booking.finalTotal ? t("bookings.finalTotal") : t("bookings.estimate")}
            </p>
            <p className="font-heading text-sm font-semibold text-fg">
              {formatCurrency(booking.finalTotal ?? booking.estimatedTotal)}
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/bookings/${booking.id}`}>
              {t("common.details")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
