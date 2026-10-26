"use client";

import { BarChart3, Package, ReceiptText, Star, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { StarRating } from "@/components/ui/star-rating";
import { StatCard } from "@/components/ui/stat-card";
import { useWorkshopBookings, useWorkshopOrders, useWorkshopReviews } from "@/lib/api/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

type ItemStat = { name: string; qty: number; revenue: number };

function topItems(
  rows: { name: string; qty: number; revenue: number }[],
  limit = 6,
): ItemStat[] {
  const map = new Map<string, ItemStat>();
  for (const row of rows) {
    const current = map.get(row.name) ?? { name: row.name, qty: 0, revenue: 0 };
    current.qty += row.qty;
    current.revenue += row.revenue;
    map.set(row.name, current);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export default function WorkshopReportsPage() {
  const t = useTranslations();
  const [period, setPeriod] = useState<Period>(30);

  const bookingsQuery = useWorkshopBookings();
  const ordersQuery = useWorkshopOrders();
  const reviewsQuery = useWorkshopReviews();

  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);

  const from = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (period - 1));
    return date.getTime();
  }, [period]);

  const paidBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.status === "paid" && booking.paidAt && new Date(booking.paidAt).getTime() >= from,
      ),
    [bookings, from],
  );

  const paidOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.paidAt && new Date(order.paidAt).getTime() >= from && order.status !== "cancelled",
      ),
    [orders, from],
  );

  const serviceRevenue = useMemo(
    () => paidBookings.reduce((sum, booking) => sum + (booking.finalTotal ?? 0), 0),
    [paidBookings],
  );
  const shopRevenue = useMemo(
    () => paidOrders.reduce((sum, order) => sum + order.total, 0),
    [paidOrders],
  );
  const totalRevenue = serviceRevenue + shopRevenue;

  const serviceStats = useMemo(
    () =>
      topItems(
        paidBookings.flatMap((booking) =>
          booking.items.map((item) => ({
            name: item.name,
            qty: item.qty,
            revenue: item.subtotal,
          })),
        ),
      ),
    [paidBookings],
  );

  const productStats = useMemo(
    () =>
      topItems(
        paidOrders.flatMap((order) =>
          order.items.map((item) => ({
            name: item.titleSnapshot,
            qty: item.qty,
            revenue: item.subtotal,
          })),
        ),
      ),
    [paidOrders],
  );

  const transactions = useMemo(() => {
    const rows = [
      ...paidBookings.map((booking) => ({
        id: booking.id,
        code: booking.code,
        at: booking.paidAt as string,
        type: "service" as const,
        amount: booking.finalTotal ?? 0,
        label: booking.vehicleLabel,
      })),
      ...paidOrders.map((order) => ({
        id: order.id,
        code: order.code,
        at: order.paidAt as string,
        type: "shop" as const,
        amount: order.total,
        label: `${order.items.reduce((sum, item) => sum + item.qty, 0)} item(s)`,
      })),
    ];
    return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);
  }, [paidBookings, paidOrders]);

  const publishedReviews = useMemo(
    () => reviews.filter((review) => review.status === "published"),
    [reviews],
  );
  const ratingAverage = publishedReviews.length
    ? publishedReviews.reduce((sum, review) => sum + review.rating, 0) / publishedReviews.length
    : 0;
  const ratingDistribution = useMemo(() => {
    const distribution = [0, 0, 0, 0, 0];
    for (const review of publishedReviews) distribution[review.rating - 1] += 1;
    return distribution;
  }, [publishedReviews]);

  const isLoading = bookingsQuery.isLoading || ordersQuery.isLoading || reviewsQuery.isLoading;
  const isError = bookingsQuery.isError || ordersQuery.isError || reviewsQuery.isError;

  if (isLoading) return <PageLoading />;
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          bookingsQuery.refetch();
          ordersQuery.refetch();
          reviewsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.reports")}
        title={t("nav.reports")}
        description={t("console.reportsSubtitle")}
        actions={
          <div className="flex rounded-input border border-line bg-surface p-0.5">
            {PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors",
                  period === option ? "bg-accent text-accentInk" : "text-muted hover:text-fg",
                )}
              >
                {option === 7
                  ? t("console.last7Days")
                  : option === 30
                    ? t("console.last30Days")
                    : t("console.last90Days")}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("console.serviceRevenue")}
          value={formatCurrency(serviceRevenue)}
          hint={t("console.paidTransactions") + ": " + paidBookings.length}
          icon={Wrench}
          accent="accent"
        />
        <StatCard
          label={t("console.shopRevenue")}
          value={formatCurrency(shopRevenue)}
          hint={t("console.paidTransactions") + ": " + paidOrders.length}
          icon={Package}
          accent="lime"
        />
        <StatCard
          label={t("console.totalRevenue")}
          value={formatCurrency(totalRevenue)}
          hint={`${paidBookings.length + paidOrders.length} ${t("console.paidTransactions").toLowerCase()}`}
          icon={BarChart3}
          accent="warning"
        />
        <StatCard
          label={t("console.ratingSummary")}
          value={ratingAverage ? ratingAverage.toFixed(1) : "—"}
          hint={t("console.reviewsCount", { count: publishedReviews.length })}
          icon={Star}
          accent="accent"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("console.topServices")}</CardTitle>
            <p className="mt-1 text-xs text-muted">{t("console.topServicesHint")}</p>
          </CardHeader>
          <CardContent>
            {serviceStats.length === 0 ? (
              <p className="text-xs text-muted">{t("console.noSalesYet")}</p>
            ) : (
              <div className="overflow-hidden rounded-input border border-line">
                <div className="grid grid-cols-[1fr_60px_120px] gap-2 bg-surface2/50 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-faint">
                  <span>{t("console.colItem")}</span>
                  <span className="text-right">{t("console.colQty")}</span>
                  <span className="text-right">{t("console.colRevenue")}</span>
                </div>
                {serviceStats.map((item) => (
                  <div
                    key={item.name}
                    className="grid grid-cols-[1fr_60px_120px] items-center gap-2 border-t border-line px-3 py-2 text-xs"
                  >
                    <span className="truncate text-fg">{item.name}</span>
                    <span className="text-right text-muted">{item.qty}</span>
                    <span className="text-right font-medium text-fg">
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("console.ratingSummary")}</CardTitle>
            <p className="mt-1 text-xs text-muted">{t("console.ratingSummaryHint")}</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-semibold text-fg">
                {ratingAverage ? ratingAverage.toFixed(1) : "—"}
              </span>
              <StarRating value={ratingAverage} size="xs" />
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {t("console.reviewsCount", { count: publishedReviews.length })}
            </p>
            <div className="mt-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingDistribution[star - 1];
                const percent = publishedReviews.length ? (count / publishedReviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="w-3 text-right">{star}</span>
                    <Star className="h-3 w-3 text-lime" />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
                      <span
                        className="block h-full rounded-full bg-lime"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("console.recentTransactions")}</CardTitle>
            <p className="mt-1 text-xs text-muted">{t("console.recentTransactionsHint")}</p>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-xs text-muted">{t("console.noSalesYet")}</p>
            ) : (
              <div className="divide-y divide-line">
                {transactions.map((row) => (
                  <div key={`${row.type}-${row.id}`} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        row.type === "service"
                          ? "bg-accent/10 text-accent"
                          : "bg-lime/10 text-lime",
                      )}
                    >
                      {row.type === "service" ? (
                        <Wrench className="h-3.5 w-3.5" />
                      ) : (
                        <ReceiptText className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-fg">
                        {row.type === "service" ? t("console.typeService") : t("console.typeShop")} ·{" "}
                        {row.code}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-faint">
                        {formatDate(row.at)} · {row.label}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-fg">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("console.topProducts")}</CardTitle>
            <p className="mt-1 text-xs text-muted">{t("console.topProductsHint")}</p>
          </CardHeader>
          <CardContent>
            {productStats.length === 0 ? (
              <p className="text-xs text-muted">{t("console.noSalesYet")}</p>
            ) : (
              <div className="space-y-2.5">
                {productStats.map((item) => (
                  <div key={item.name} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate text-fg">{item.name}</p>
                      <p className="mt-0.5 text-[11px] text-faint">
                        {item.qty} × {t("console.colQty").toLowerCase()}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium text-fg">
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
