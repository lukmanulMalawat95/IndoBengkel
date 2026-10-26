"use client";

import { Eye, EyeOff, Loader2, LogIn, UserRound, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const roleHomes: Record<UserRole, string> = {
  customer: "/",
  workshop_owner: "/workshop",
};

function LoginContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { user, isLoading, login, switchDemoRole } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!isLoading && user) router.replace(returnTo ?? roleHomes[user.role]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  if (isLoading) return <PageLoading />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const nextUser = await login(email, password);
      toast.success(t("auth.loginSuccess"));
      router.replace(returnTo ?? roleHomes[nextUser.role]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("auth.invalidCredentials");
      setError(message);
    } finally {
      setPending(false);
    }
  };

  const useDemo = async (role: UserRole) => {
    setError("");
    setDemoPending(role);
    try {
      const nextUser = await switchDemoRole(role);
      toast.success(t("auth.loginSuccess"));
      router.replace(returnTo ?? roleHomes[nextUser.role]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("auth.error"));
    } finally {
      setDemoPending(null);
    }
  };

  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-fg">
          {t("auth.loginTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{t("auth.loginSubtitle")}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label={t("auth.email")}>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="rina@indobengkel.test"
          />
        </Field>

        <Field label={t("auth.password")}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-fg"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <div className="flex items-center justify-between gap-3">
          <Link href="/auth/forgot-password" className="text-xs text-accent hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={pending || !email || !password}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {pending ? t("auth.loggingIn") : t("auth.login")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-faint">{t("auth.demoAccounts")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-2">
        {(
          [
            { role: "customer" as UserRole, icon: UserRound, label: t("auth.customerDemo"), email: "rina@indobengkel.test" },
            { role: "workshop_owner" as UserRole, icon: Wrench, label: t("auth.workshopDemo"), email: "andi@kawahmotor.test" },
          ] as const
        ).map((item) => (
          <button
            key={item.role}
            type="button"
            disabled={demoPending !== null}
            onClick={() => useDemo(item.role)}
            className={cn(
              "flex items-center gap-3 rounded-input border border-line bg-surface2/50 p-3 text-left transition-colors hover:border-lineStrong disabled:opacity-60",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full chip-accent">
              {demoPending === item.role ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <item.icon className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-fg">{item.label}</span>
              <span className="block truncate text-[10px] text-faint">{item.email}</span>
            </span>
            <span className="shrink-0 text-[10px] text-accent">{t("auth.useDemo")}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-faint">{t("auth.demoHint")}</p>

      <div className="mt-6 space-y-2 border-t border-line pt-5 text-center text-xs text-muted">
        <p>
          {t("auth.dontHaveAccount")}{" "}
          <Link href="/auth/register" className="font-medium text-accent hover:underline">
            {t("auth.createAccountTitle")}
          </Link>
        </p>
        <p>
          {t("auth.workshopCta")}{" "}
          <Link href="/auth/register/workshop" className="font-medium text-accent hover:underline">
            {t("auth.workshopRegisterTitle")}
          </Link>
        </p>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LoginContent />
    </Suspense>
  );
}
