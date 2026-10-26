"use client";

import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  Package,
  Star,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { StarRating } from "@/components/ui/star-rating";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useWorkshopDashboard } from "@/lib/api/hooks";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function WorkshopDashboardPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const dashboardQuery = useWorkshopDashboard();

  if (dashboardQuery.isLoading) return <PageLoading />;
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <ErrorState onRetry={() => dashboardQuery.refetch()} />;
  }

  const data = dashboardQuery.data;
  const { workshop } = data;
  const pendingChecklist = data.profileChecklist.filter((item) => !item.done);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.dashboard")}
        title={t("console.welcome", { name: user?.fullName.split(" ")[0] ?? "" })}
        description={t("console.dashboardSubtitle")}
        actions={
          <Badge variant={workshop.openNow ? "lime" : "default"}>
            {workshop.openNow ? t("common.open") : t("common.closed")}
          </Badge>
        }
      />

      {workshop.status === "suspended" ? (
        <div className="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <p className="font-medium">{t("console.suspendedTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("console.suspendedBody")}</p>
        </div>
      ) : null}

      {pendingChecklist.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                <Wrench className="h-4 w-4 text-warning" /> {t("console.completeProfile")}
              </p>
              <p className="mt-1 text-xs text-muted">{t("console.completeProfileBody")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.profileChecklist.map((item) => (
                  <Badge key={item.key} variant={item.done ? "success" : "warning"}>
                    {item.done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                    {item.label}
                  </Badge>
                ))}
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/workshop/profile">{t("console.activateProfile")}</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("console.revenueThisMonth")}
          value={formatCurrency(data.revenueThisMonth)}
          icon={TrendingUp}
          accent="accent"
        />
        <StatCard
          label={t("console.rating")}
          value={data.ratingAvg.toFixed(1)}
          hint={t("console.reviews", { count: data.ratingCount })}
          icon={Star}
          accent="lime"
        />
        <StatCard
          label={t("console.activeServices")}
          value={String(data.activeServiceOrders.length)}
          icon={Wrench}
        />
        <StatCard
          label={t("console.ordersToPrepare")}
          value={String(data.ordersNeedingAction.length)}
          icon={Package}
          accent="warning"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{t("console.today")}</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted">{t("console.todaySubtitle")}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/workshop/bookings">
                {t("console.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.todayBookings.length === 0 ? (
              <EmptyRow icon={CalendarClock} title={t("console.noToday")} body={t("console.noTodayBody")} />
            ) : (
              data.todayBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/workshop/bookings/${booking.id}`}
                  className="flex items-center gap-3 rounded-input border border-line bg-surface2/40 p-3 transition-colors hover:border-lineStrong"
                >
                  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full chip-accent">
                    <Clock3 className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{booking.customerName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {formatTime(booking.scheduledAt)} · {booking.vehicleLabel} · {booking.plateNumber}
                    </p>
                  </div>
                  <StatusBadge kind="service" status={booking.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{t("console.activeServices")}</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted">{t("console.activeServicesSubtitle")}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/workshop/bookings">
                {t("console.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.activeServiceOrders.length === 0 ? (
              <EmptyRow icon={Wrench} title={t("console.noActive")} body={t("console.noActiveBody")} />
            ) : (
              data.activeServiceOrders.slice(0, 5).map((booking) => (
                <Link
                  key={booking.id}
                  href={`/workshop/bookings/${booking.id}`}
                  className="flex items-center gap-3 rounded-input border border-line bg-surface2/40 p-3 transition-colors hover:border-lineStrong"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-lime/20 bg-lime/[0.07] text-lime">
                    <Wrench className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{booking.customerName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {booking.code} · {booking.vehicleLabel}
                    </p>
                  </div>
                  <StatusBadge kind="service" status={booking.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{t("console.ordersToPrepare")}</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted">{t("console.ordersToPrepareSubtitle")}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/workshop/orders">
                {t("console.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.ordersNeedingAction.length === 0 ? (
              <EmptyRow icon={Package} title={t("console.noOrders")} body={t("console.noOrdersBody")} />
            ) : (
              data.ordersNeedingAction.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href={`/workshop/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-input border border-line bg-surface2/40 p-3 transition-colors hover:border-lineStrong"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warning/25 bg-warning/10 text-warning">
                    <Package className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{order.customerName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {order.code} · {order.items.length} {t("common.items")} · {formatCurrency(order.total)}
                    </p>
                  </div>
                  <StatusBadge kind="order" status={order.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{t("console.recentReviews")}</CardTitle>
              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                <StarRating value={data.ratingAvg} size="sm" /> {data.ratingAvg.toFixed(1)} · {data.ratingCount}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/workshop/reviews">
                {t("console.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentReviews.length === 0 ? (
              <EmptyRow icon={Star} title={t("console.noReviews")} body={t("console.noReviewsBody")} />
            ) : (
              data.recentReviews.map((review) => (
                <div key={review.id} className="rounded-input border border-line bg-surface2/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <StarRating value={review.rating} size="sm" />
                    <span className="text-[10px] text-faint">{formatDateTime(review.createdAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{review.comment}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyRow({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-input border border-dashed border-line py-8 text-center")}>
      <Icon className="h-5 w-5 text-faint" />
      <p className="mt-2 text-sm font-medium text-fg">{title}</p>
      <p className="mt-0.5 max-w-xs text-[11px] text-muted">{body}</p>
    </div>
  );
}
