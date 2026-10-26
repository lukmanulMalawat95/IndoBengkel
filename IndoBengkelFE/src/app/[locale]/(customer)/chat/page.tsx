"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConversationList } from "@/components/domain/conversation-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";

export default function ChatPage() {
  const t = useTranslations();
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("chat.loginRequired")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.signInToContinue")}</p>
        <Button asChild className="mt-4">
          <Link href="/auth/login?returnTo=/chat">{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.messages")}
        title={t("chat.title")}
        description={t("chat.subtitle")}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/workshops">{t("chat.findWorkshop")}</Link>
          </Button>
        }
      />
      <ConversationList mode="customer" />
    </div>
  );
}
