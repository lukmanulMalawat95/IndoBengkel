"use client";

import {
  BadgeCheck,
  Building2,
  Check,
  Languages,
  LogOut,
  Moon,
  Sun,
  UserRound,
  Wrench,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const roleIcons: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  customer: UserRound,
  workshop_owner: Wrench,
};

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, isLoading, logout, verifyEmail } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (isLoading) return null;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <UserRound className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("profile.notSignedIn")}</h1>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild>
            <Link href="/auth/login?returnTo=/profile">{t("profile.signIn")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/auth/register">{t("profile.createAccount")}</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const RoleIcon = roleIcons[user.role];

  const switchLanguage = (next: "en" | "id") => {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
    router.replace(pathname, { locale: next });
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t("nav.you")} title={t("profile.title")} description={t("profile.subtitle")} />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <Avatar name={user.fullName} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-xl font-semibold text-fg">{user.fullName}</h2>
                  {user.emailVerified ? (
                    <Badge variant="success"><BadgeCheck className="h-3 w-3" /> {t("profile.verified")}</Badge>
                  ) : (
                    <Badge variant="warning">{t("profile.unverified")}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{user.email}</p>
                <p className="mt-0.5 text-xs text-faint">{user.phone}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="accent"><RoleIcon className="h-3 w-3" /> {t(`roles.${user.role}`)}</Badge>
                  <span className="text-[11px] text-faint">
                    {t("profile.memberSince")} {formatDate(user.createdAt)}
                  </span>
                </div>
              </div>
              {!user.emailVerified ? (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await verifyEmail();
                      toast.success(t("auth.verifySuccess"));
                    } catch {
                      toast.error(t("toasts.error"));
                    }
                  }}
                >
                  <BadgeCheck className="h-4 w-4" /> {t("profile.verifyNow")}
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-2">
              <Info label={t("profile.email")} value={user.email} />
              <Info label={t("profile.phone")} value={user.phone} />
              <Info label={t("profile.role")} value={t(`roles.${user.role}`)} />
              <Info label={t("profile.emailVerified")} value={user.emailVerified ? t("profile.verified") : t("profile.unverified")} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("profile.preferences")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Languages className="h-3.5 w-3.5" /> {t("profile.language")}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(["en", "id"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => switchLanguage(item)}
                      className={cn(
                        "flex items-center justify-between rounded-input border p-3 text-sm transition-colors",
                        locale === item
                          ? "border-accent/40 bg-accent/5 text-fg"
                          : "border-line bg-surface text-muted hover:text-fg",
                      )}
                    >
                      {item === "en" ? t("profile.english") : t("profile.indonesian")}
                      {locale === item ? <Check className="h-4 w-4 text-accent" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted">{t("profile.theme")}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(["dark", "light"] as const).map((item) => {
                    const active = theme === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setTheme(item)}
                        className={cn(
                          "flex items-center justify-between rounded-input border p-3 text-sm transition-colors",
                          active
                            ? "border-accent/40 bg-accent/5 text-fg"
                            : "border-line bg-surface text-muted hover:text-fg",
                        )}
                      >
                        <span className="inline-flex items-center gap-2">
                          {item === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                          {item === "dark" ? t("profile.dark") : t("profile.light")}
                        </span>
                        {active ? <Check className="h-4 w-4 text-accent" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.sessions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{t("profile.currentSession")}</span>
                <Badge variant="success">{t("common.now")}</Badge>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut className="h-4 w-4" /> {t("profile.logout")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("profile.about")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("profile.version")}</span>
                <span className="text-fg">0.1.0</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("profile.links")}</span>
                <span className="flex gap-3 text-accent">
                  <Link href="/">{t("profile.privacy")}</Link>
                  <Link href="/">{t("profile.terms")}</Link>
                  <Link href="/">{t("profile.help")}</Link>
                </span>
              </div>
              <p className="pt-2 text-[10px] leading-relaxed text-faint">
                {t("common.idrOnly")}
              </p>
            </CardContent>
          </Card>

          {user.role === "workshop_owner" ? (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-xs text-muted">
                <Building2 className="h-4 w-4 text-accent" /> {t("console.dashboard")}
              </p>
              <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                <Link href="/workshop">{t("console.dashboard")}</Link>
              </Button>
            </Card>
          ) : null}
        </aside>
      </div>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profile.logout")}</DialogTitle>
            <DialogDescription>{t("profile.logoutConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                logout();
                setLogoutOpen(false);
                toast.success(t("auth.logoutSuccess"));
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" /> {t("profile.logout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-input border border-line bg-surface2/40 p-2.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className="mt-1 truncate text-xs text-fg">{value}</p>
    </div>
  );
}
