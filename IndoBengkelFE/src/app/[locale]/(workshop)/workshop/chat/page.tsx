"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChatThread } from "@/components/domain/chat-thread";
import { ConversationList } from "@/components/domain/conversation-list";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { cn } from "@/lib/utils";

function WorkshopChatContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("thread") ?? "";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("console.inbox")}
        title={t("chat.workshopInbox")}
        description={t("console.chatSubtitle")}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className={cn(selectedId ? "hidden lg:block" : "block")}>
          <ConversationList
            mode="workshop"
            selectedId={selectedId || undefined}
            onSelect={(id) => router.replace(`/workshop/chat?thread=${id}`)}
            className="max-h-[calc(100dvh-14rem)] overflow-y-auto lg:max-h-none"
          />
        </div>

        <div className={cn(selectedId ? "block" : "hidden lg:block")}>
          {selectedId ? (
            <ChatThread
              conversationId={selectedId}
              mode="workshop"
              onBack={() => router.replace("/workshop/chat")}
              className="h-[calc(100dvh-14rem)] min-h-[34rem]"
            />
          ) : (
            <Card className="flex h-[calc(100dvh-14rem)] min-h-[34rem] flex-col items-center justify-center p-6 text-center">
              <MessageSquare className="h-9 w-9 text-faint" />
              <h2 className="mt-3 font-heading text-base font-semibold text-fg">
                {t("chat.selectConversation")}
              </h2>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                {t("chat.selectConversationBody")}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkshopChatPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WorkshopChatContent />
    </Suspense>
  );
}
