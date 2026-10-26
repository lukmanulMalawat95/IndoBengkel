"use client";

import { ArrowLeft, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ChatThread } from "@/components/domain/chat-thread";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations();
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("chat.loginRequired")}</h1>
        <Button asChild className="mt-4">
          <Link href={`/auth/login?returnTo=/chat/${params.id}`}>{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Link href="/chat" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("chat.title")}
      </Link>
      <ChatThread
        conversationId={params.id}
        mode="customer"
        className="h-[calc(100dvh-12.5rem)] min-h-[34rem]"
      />
    </div>
  );
}
