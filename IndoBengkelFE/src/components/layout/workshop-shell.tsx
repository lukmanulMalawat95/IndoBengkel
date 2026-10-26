"use client";

import {
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  MessageSquare,
  Package,
  Star,
  Store,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const links = [
  { href: "/workshop", labelKey: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/workshop/bookings", labelKey: "bookings", icon: CalendarClock },
  { href: "/workshop/orders", labelKey: "orders", icon: Package },
  { href: "/workshop/reviews", labelKey: "reviews", icon: Star },
  { href: "/workshop/reports", labelKey: "reports", icon: TrendingUp },
  { href: "/workshop/chat", labelKey: "chat", icon: MessageSquare },
] as const;

const manageLinks = [
  { href: "/workshop/profile", labelKey: "profile", icon: Store },
  { href: "/workshop/mechanics", labelKey: "mechanics", icon: Users },
  { href: "/workshop/services", labelKey: "services", icon: Wrench },
  { href: "/workshop/products", labelKey: "products", icon: Package },
] as const;

function active(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkshopShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface/50 lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
            {t("nav.workshop")}
          </p>
          <nav className="space-y-1">
            {links.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
          <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
            {t("common.manage")}
          </p>
          <nav className="space-y-1">
            {manageLinks.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>
        <div className="border-t border-line p-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-input px-3 py-2 text-xs text-muted transition-colors hover:bg-surface2 hover:text-fg"
          >
            <BarChart3 className="h-4 w-4" />
            {t("nav.backToApp")}
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo compact />
              <span className="text-xs font-medium text-muted">{t("nav.workshop")}</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-medium text-muted">{t("nav.workshop")}</p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <LocaleSwitcher />
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
            {[...links, ...manageLinks].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium",
                  active(pathname, item.href, "exact" in item ? item.exact : false)
                    ? "bg-accent/12 text-accent"
                    : "text-muted",
                )}
              >
                {t(`nav.${item.labelKey}`)}
              </Link>
            ))}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  pathname,
}: {
  item: (typeof links)[number] | (typeof manageLinks)[number];
  pathname: string;
}) {
  const t = useTranslations();
  const isActive = active(pathname, item.href, "exact" in item ? item.exact : false);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors",
        isActive ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface2 hover:text-fg",
      )}
    >
      <item.icon className="h-4 w-4" />
      {t(`nav.${item.labelKey}`)}
    </Link>
  );
}
