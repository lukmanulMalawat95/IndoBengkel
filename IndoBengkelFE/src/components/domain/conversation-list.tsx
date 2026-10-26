"use client";

import { ChevronRight, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useConversations } from "@/lib/api/hooks";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConversationList({
  mode,
  selectedId,
  onSelect,
  className,
}: {
  mode: "customer" | "workshop";
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const t = useTranslations();
  const { user } = useAuth();
  const conversationsQuery = useConversations(Boolean(user), mode);

  if (conversationsQuery.isLoading) return <PageLoading />;
  if (conversationsQuery.isError) return <ErrorState onRetry={() => conversationsQuery.refetch()} />;

  const conversations = conversationsQuery.data ?? [];

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={t("chat.noConversations")}
        description={t("chat.noConversationsBody")}
        action={
          mode === "customer" ? (
            <Link href="/workshops" className="text-sm text-accent hover:underline">
              {t("chat.findWorkshop")}
            </Link>
          ) : undefined
        }
        className={className}
      />
    );
  }

  return (
    <div className={cn("divide-y divide-line overflow-hidden rounded-card border border-line bg-surface", className)}>
      {conversations.map((conversation) => {
        const displayName = mode === "customer" ? conversation.workshopName : conversation.customerName;
        const active = conversation.id === selectedId;
        const content = (
          <>
            <Avatar name={displayName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-fg">{displayName}</p>
                <span className="shrink-0 text-[10px] text-faint">
                  {relativeTime(conversation.lastMessageAt)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted">{conversation.lastMessage ?? t("chat.noMessages")}</p>
                {conversation.unreadCount > 0 ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accentInk">
                    {conversation.unreadCount}
                  </span>
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                )}
              </div>
            </div>
          </>
        );

        if (onSelect) {
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                "flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface2/60",
                active ? "bg-accent/5" : "",
              )}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={conversation.id}
            href={`/chat/${conversation.id}`}
            className="flex items-center gap-3 p-3.5 transition-colors hover:bg-surface2/60"
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
