"use client";

import { Bell } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useNotifications } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const { data: notifications = [] } = useNotifications(Boolean(user));
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-lineStrong hover:text-fg",
        className,
      )}
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accentInk">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
