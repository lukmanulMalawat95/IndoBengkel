"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";

export default function RegisterCustomerPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading, registerCustomer } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  if (isLoading) return <PageLoading />;

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.password) {
      setError(t("validation.required"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("validation.minPassword"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("validation.passwordMismatch"));
      return;
    }
    if (!terms) {
      setError(t("validation.terms"));
      return;
    }
    setPending(true);
    try {
      await registerCustomer({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      toast.success(t("auth.registerSuccess"));
      router.push("/auth/verify");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("auth.error"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-fg">
          {t("auth.registerTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{t("auth.registerSubtitle")}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label={t("auth.fullName")}>
          <Input
            required
            value={form.fullName}
            onChange={(event) => set("fullName", event.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label={t("auth.email")} hint={t("auth.emailHint")}>
          <Input
            type="email"
            required
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label={t("auth.phone")} hint={t("auth.phoneHint")}>
          <Input
            required
            value={form.phone}
            onChange={(event) => set("phone", event.target.value)}
            placeholder="+62 812 0000 0000"
            autoComplete="tel"
          />
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
          <Input
            type="password"
            required
            value={form.password}
            onChange={(event) => set("password", event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label={t("auth.confirmPassword")}>
          <Input
            type="password"
            required
            value={form.confirmPassword}
            onChange={(event) => set("confirmPassword", event.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-muted">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
          />
          {t("auth.terms")}
        </label>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {pending ? t("auth.registering") : t("auth.register")}
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-5 text-center text-xs text-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/auth/login" className="font-medium text-accent hover:underline">
          {t("auth.login")}
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted">
        {t("auth.workshopCta")}{" "}
        <Link href="/auth/register/workshop" className="font-medium text-accent hover:underline">
          {t("auth.workshopRegisterTitle")}
        </Link>
      </p>
    </Card>
  );
}
