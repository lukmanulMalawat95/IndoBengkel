"use client";

import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { Link, useRouter } from "@/i18n/navigation";

function ResetContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("validation.minPassword"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("validation.passwordMismatch"));
      return;
    }
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPending(false);
    toast.success(t("auth.resetSuccess"));
    router.replace("/auth/login");
  };

  return (
    <Card className="p-6 sm:p-7">
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("auth.backToLogin")}
      </Link>

      <div className="mt-5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-fg">
          {t("auth.resetPassword")}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{t("auth.resetBody")}</p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label={t("auth.resetToken")}>
          <Input value={token} readOnly className="font-mono text-xs" />
        </Field>
        <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
          <Input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t("auth.confirmPassword")}>
          <Input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {t("auth.resetPassword")}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ResetContent />
    </Suspense>
  );
}
