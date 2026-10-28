"use client";

import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
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

const roleHomes: Record<UserRole, string> = {
  customer: "/",
  workshop_owner: "/workshop",
};

function LoginContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { user, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
