"use client";

import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setPending(false);
    setSent(true);
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
        <p className="mt-1.5 text-sm text-muted">{t("auth.resetSentBody")}</p>
      </div>

      {sent ? (
        <div className="mt-6 text-center">
          <MailCheck className="mx-auto h-9 w-9 text-accent" />
          <p className="mt-3 font-heading text-lg font-semibold text-fg">{t("auth.resetSent")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t("auth.resetSentBody")}</p>
          <Button asChild className="mt-5 w-full">
            <Link href="/auth/login">{t("auth.backToLogin")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label={t("auth.email")}>
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={pending || !email.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("auth.sendReset")}
          </Button>
        </form>
      )}
    </Card>
  );
}
