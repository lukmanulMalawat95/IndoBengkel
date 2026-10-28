"use client";

import {
  Compass,
  Home,
  MapPin,
  MessageSquare,
  ShoppingBag,
  Store,
  UserRound,
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

const navItems = [
  { href: "/workshops", labelKey: "discover", icon: Compass },
  { href: "/shop", labelKey: "shop", icon: ShoppingBag },
  { href: "/vehicles", labelKey: "garage", icon: Wrench },
  { href: "/chat", labelKey: "chat", icon: MessageSquare },
] as const;

const mobileItems = [
  { href: "/", labelKey: "home", icon: Home, exact: true },
  { href: "/workshops", labelKey: "discover", icon: Compass },
  { href: "/shop", labelKey: "shop", icon: ShoppingBag },
  { href: "/chat", labelKey: "chat", icon: MessageSquare },
  { href: "/profile", labelKey: "you", icon: UserRound },
] as const;

function isActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-7">
            <Logo />
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-full px-3 py-2 text-xs font-medium transition-colors",
                      active
                        ? "bg-surface2 text-fg"
                        : "text-muted hover:bg-surface2 hover:text-fg",
                    )}
                  >
                    {t(`nav.${item.labelKey}`)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/workshops"
              className="hidden h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[11px] font-medium text-muted transition-colors hover:border-lineStrong hover:text-fg sm:inline-flex"
            >
              <MapPin className="h-3.5 w-3.5 text-accent" />
              Jakarta
            </Link>
            <ThemeToggle />
            <LocaleSwitcher />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-16">
        {children}
      </main>

      <footer className="hidden border-t border-line bg-surface/40 py-8 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-8 text-xs text-faint">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-accent" />
            <span>IndoBengkel</span>
          </div>
          <p>{t("common.pickupOrDelivery")} · {t("common.idrOnly")}</p>
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden"
        aria-label="Mobile primary"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobileItems.map((item) => {
            const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-faint hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-10 items-center justify-center rounded-full",
                    active ? "bg-accent/12" : "",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                {t(`nav.${item.labelKey}`)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
