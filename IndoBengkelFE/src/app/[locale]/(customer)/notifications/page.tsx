"use client";

import {
  Bell,
  CalendarCheck,
  CheckCheck,
  MessageSquare,
  Package,
  ShieldAlert,
  Star,
  Truck,
  Wrench,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/api/hooks";
import type { Notification, NotificationType } from "@/lib/api/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const iconByType: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  booking_requested: CalendarCheck,
  booking_confirmed: CalendarCheck,
  booking_declined: CalendarCheck,
  service_started: Wrench,
  estimate_approval: ShieldAlert,
  service_completed: Wrench,
  service_paid: CheckCheck,
  service_payment_expired: XCircle,
  order_created: Package,
  order_paid: Package,
  order_expired: XCircle,
  order_ready: Package,
  order_shipped: Truck,
  order_completed: Package,
  chat_message: MessageSquare,
  review_reply: Star,
  service_reminder: Bell,
  workshop_suspended: ShieldAlert,
};

export default function NotificationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const notificationsQuery = useNotifications(Boolean(user));
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <Bell className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.signInToContinue")}</p>
        <Button asChild className="mt-4">
          <Link href="/auth/login?returnTo=/notifications">{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (notificationsQuery.isLoading) return <PageLoading />;
  if (notificationsQuery.isError) return <ErrorState onRetry={() => notificationsQuery.refetch()} />;

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const visible = filter === "unread" ? notifications.filter((item) => !item.readAt) : notifications;

  const openNotification = async (notification: Notification) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    if (notification.href) router.push(notification.href);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("nav.inbox")}</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("notifications.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("notifications.subtitle")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={async () => {
            try {
              await markAllRead.mutateAsync();
              toast.success(t("toasts.saved"));
            } catch {
              toast.error(t("toasts.error"));
            }
          }}
        >
          <CheckCheck className="h-4 w-4" /> {t("notifications.markAllRead")}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "unread"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-medium",
              filter === item
                ? "border-accent/40 bg-accent/12 text-accent"
                : "border-line bg-surface text-muted hover:text-fg",
            )}
          >
            {t(`notifications.${item}`)}
            {item === "unread" && unreadCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] text-accent">
                {unreadCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t("notifications.empty")}
          description={t("notifications.emptyBody")}
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {visible.map((notification) => {
            const Icon = iconByType[notification.type] ?? Bell;
            const unread = !notification.readAt;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={cn(
                  "flex w-full gap-3 p-4 text-left transition-colors hover:bg-surface2/60",
                  unread ? "bg-accent/[0.04]" : "",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                    unread
                      ? "border-accent/25 bg-accent/10 text-accent"
                      : "border-line bg-surface2 text-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">{notification.title}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-faint">
                        {t(`notifications.types.${notification.type}`)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-faint">{relativeTime(notification.createdAt)}</span>
                      {unread ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{notification.body}</p>
                  {unread ? (
                    <Badge variant="accent" className="mt-2">{t("notifications.unread")}</Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
