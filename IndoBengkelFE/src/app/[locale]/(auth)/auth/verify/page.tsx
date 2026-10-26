"use client";

import { BadgeCheck, Loader2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/api/types";

const roleHomes: Record<UserRole, string> = {
  customer: "/",
  workshop_owner: "/workshop",
};

function VerifyContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { user, isLoading, verifyEmail } = useAuth();
  const [pending, setPending] = useState(false);

  if (isLoading) return <PageLoading />;

  if (!user) {
    return (
      <Card className="p-6 text-center sm:p-7">
        <MailCheck className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("common.authRequired")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.signInToContinue")}</p>
        <Button asChild className="mt-4">
          <Link href="/auth/login">{t("auth.login")}</Link>
        </Button>
      </Card>
    );
  }

  const verify = async () => {
    setPending(true);
    try {
      await verifyEmail();
      toast.success(t("auth.verifySuccess"));
      router.replace(next ?? roleHomes[user.role]);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("auth.error"));
    } finally {
      setPending(false);
    }
  };

  if (user.emailVerified) {
    return (
      <Card className="p-6 text-center sm:p-7">
        <BadgeCheck className="mx-auto h-9 w-9 text-success" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("auth.verifiedTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.verifiedBody")}</p>
        <Button asChild className="mt-4">
          <Link href={next ?? roleHomes[user.role]}>{t("auth.continue")}</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-7">
      <div className="text-center">
        <MailCheck className="mx-auto h-9 w-9 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("auth.verifyTitle")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("auth.verifySubtitle")}</p>
      </div>
      <p className="mt-5 rounded-input border border-line bg-surface2/50 p-3 text-center text-xs leading-relaxed text-muted">
        {t("auth.verifyBody", { email: user.email })}
      </p>
      <Button onClick={verify} disabled={pending} className="mt-5 w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
        {t("auth.verifyNow")}
      </Button>
      <p className="mt-4 text-center text-xs text-muted">
        <Link href={next ?? roleHomes[user.role]} className="text-accent hover:underline">
          {t("auth.continue")}
        </Link>
      </p>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <VerifyContent />
    </Suspense>
  );
}
