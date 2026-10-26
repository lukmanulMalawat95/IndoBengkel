"use client";

import {
  ArrowLeft,
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  MessageSquare,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { UploadProgressBar } from "@/components/ui/image-upload";
import { PageLoading } from "@/components/ui/page-loading";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import {
  useConversation,
  useMarkConversationRead,
  useSendMessage,
} from "@/lib/api/hooks";
import type { Message } from "@/lib/api/types";
import { formatTime } from "@/lib/format";
import { UploadError, uploadImage, type UploadProgress } from "@/lib/upload-image";
import { cn } from "@/lib/utils";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function ChatThread({
  conversationId,
  mode,
  onBack,
  className,
}: {
  conversationId: string;
  mode: "customer" | "workshop";
  onBack?: () => void;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const conversationQuery = useConversation(conversationId, Boolean(user));
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const conversation = conversationQuery.data?.conversation;
  // Always render oldest -> newest so the latest message sits at the bottom,
  // even if the API returns messages in a different order.
  const messages = useMemo(
    () =>
      [...(conversationQuery.data?.messages ?? [])].sort(
        (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
      ),
    [conversationQuery.data?.messages],
  );
  const unreadCount = messages.filter(
    (message) => message.senderUserId !== user?.id && !message.readAt,
  ).length;

  useEffect(() => {
    if (!conversationId || unreadCount === 0) return;
    markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, unreadCount]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  if (conversationQuery.isLoading) return <PageLoading />;
  if (conversationQuery.isError || !conversation) {
    return <ErrorState title={t("chat.notFound")} onRetry={() => conversationQuery.refetch()} />;
  }

  const displayName = mode === "customer" ? conversation.workshopName : conversation.customerName;

  const handleFile = async (file?: File) => {
    setFileError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError(t("chat.imageOnly"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFileError(t("chat.imageTooLarge"));
      return;
    }
    setUploadProgress({ stage: "reading", percent: 2 });
    try {
      const url = await uploadImage(file, setUploadProgress);
      setAttachment({ url, name: file.name });
    } catch (caught) {
      const code = caught instanceof UploadError ? caught.code : "network";
      setFileError(
        code === "type"
          ? t("uploads.errorType")
          : code === "size"
            ? t("chat.imageTooLarge")
            : code === "decode"
              ? t("uploads.errorDecode")
              : t("uploads.errorNetwork"),
      );
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const uploading = uploadProgress !== null && uploadProgress.stage !== "done";

  const submit = async () => {
    if (!body.trim() && !attachment) return;
    try {
      await sendMessage.mutateAsync({
        conversationId,
        body: body.trim() || t("chat.imageMessage"),
        attachmentUrl: attachment?.url,
      });
      setBody("");
      setAttachment(null);
      setFileError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface", className)}>
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-fg lg:hidden"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <Avatar name={displayName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{displayName}</p>
          <p className="flex items-center gap-1 text-[10px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {mode === "customer" ? t("chat.workshopSubtitle") : t("chat.customerSubtitle")}
          </p>
        </div>
        {mode === "customer" ? (
          <Link
            href={`/workshops/${conversation.workshopSlug}`}
            className="shrink-0 rounded-full border border-line bg-surface2 px-2.5 py-1 text-[10px] font-medium text-muted hover:text-fg"
          >
            {t("chat.viewWorkshop")}
          </Link>
        ) : null}
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-bg/40 px-3 py-4 sm:px-4">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-card border border-line bg-surface/70 p-3 text-center">
          <ShieldAlert className="h-4 w-4 text-accent" />
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{t("chat.moderationNote")}</p>
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-8 w-8 text-faint" />
            <p className="mt-3 text-sm font-medium text-fg">{t("chat.noMessages")}</p>
            <p className="mt-1 text-xs text-muted">{t("chat.noMessagesBody")}</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              own={message.senderUserId === user?.id}
              mode={mode}
              locale={locale as "en" | "id"}
            />
          ))
        )}
      </div>

      <div className="border-t border-line bg-surface p-2.5 sm:p-3">
        {attachment ? (
          <div className="mb-2 flex items-center gap-2 rounded-input border border-line bg-surface2/60 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.url} alt={attachment.name} className="h-12 w-12 rounded object-cover" />
            <p className="min-w-0 flex-1 truncate text-[11px] text-muted">{attachment.name}</p>
            <button
              type="button"
              onClick={() => {
                setAttachment(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded-full p-1 text-faint hover:bg-surface3 hover:text-fg"
              aria-label={t("common.remove")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {fileError ? <p className="mb-2 text-[11px] text-danger">{fileError}</p> : null}
        {uploadProgress ? <UploadProgressBar progress={uploadProgress} className="mb-2" /> : null}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(attachment) || uploading}
            title={t("chat.attach")}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("chat.inputPlaceholder")}
              rows={1}
              maxLength={2000}
              className="max-h-32 min-h-10 resize-none py-2.5"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="icon"
            onClick={submit}
            disabled={sendMessage.isPending || uploading || (!body.trim() && !attachment)}
            title={t("chat.send")}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
          <p className="text-[9px] text-faint">{t("chat.imageLimit")}</p>
          {body.length > 1800 ? (
            <p className="text-[9px] text-warning">{body.length}/2000</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  own,
  mode,
  locale,
}: {
  message: Message;
  own: boolean;
  mode: "customer" | "workshop";
  locale: "en" | "id";
}) {
  const t = useTranslations();
  const removed = Boolean(message.deletedAt);
  const senderLabel =
    message.senderUserId === undefined
      ? ""
      : mode === "customer"
        ? t("chat.workshopSubtitle")
        : t("chat.customerSubtitle");

  return (
    <div className={cn("flex gap-2", own ? "justify-end" : "justify-start")}>
      {!own ? <Avatar name={message.senderName} size="sm" className="mt-auto" /> : null}
      <div className={cn("max-w-[82%] sm:max-w-[72%]", own ? "items-end" : "items-start")}>
        {!own ? (
          <p className="mb-0.5 px-1 text-[10px] font-medium text-faint">
            {message.senderName} · {senderLabel}
          </p>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
            own
              ? "rounded-br-md bg-accent text-accentInk"
              : "rounded-bl-md border border-line bg-surface2 text-fg",
            removed ? "italic opacity-70" : "",
          )}
        >
          {removed ? (
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3" /> {t("chat.messageRemoved")}
            </span>
          ) : (
            <>
              {message.attachmentUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={message.attachmentUrl}
                  alt={t("chat.attachment")}
                  className="mb-1.5 max-h-64 w-full rounded-lg object-cover"
                />
              ) : null}
              {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
            </>
          )}
        </div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 px-1 text-[9px] text-faint",
            own ? "justify-end" : "justify-start",
          )}
        >
          <span>{formatTime(message.createdAt, locale)}</span>
          {own ? (
            message.readAt ? (
              <CheckCheck className="h-3 w-3 text-accent" />
            ) : (
              <Check className="h-3 w-3" />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
