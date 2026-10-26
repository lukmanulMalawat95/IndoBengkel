"use client";

import { Loader2, MessageSquare, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { StarRating } from "@/components/ui/star-rating";
import { Textarea } from "@/components/ui/textarea";
import { useReplyReview, useWorkshopReviews } from "@/lib/api/hooks";
import type { Review } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { maskName } from "@/lib/utils";

export default function WorkshopReviewsPage() {
  const t = useTranslations();
  const reviewsQuery = useWorkshopReviews();
  const replyReview = useReplyReview();
  const [replying, setReplying] = useState<Review | null>(null);
  const [reply, setReply] = useState("");

  const reviews = reviewsQuery.data ?? [];
  const summary = useMemo(() => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      distribution[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
    });
    const avg = reviews.length
      ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
      : 0;
    return { distribution, avg };
  }, [reviews]);

  if (reviewsQuery.isLoading) return <PageLoading />;
  if (reviewsQuery.isError) return <ErrorState onRetry={() => reviewsQuery.refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.reviews")}
        title={t("console.reviews")}
        description={t("console.reviewsSubtitle")}
      />

      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title={t("console.noReviews")}
          description={t("console.noReviewsBody")}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={review.customerName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-fg">{maskName(review.customerName)}</p>
                        <Badge variant={review.status === "published" ? "success" : "danger"}>
                          {review.status === "published" ? t("console.published") : t("console.hidden")}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-faint">{formatDate(review.createdAt)}</span>
                    </div>
                    <StarRating value={review.rating} size="xs" className="mt-1" />
                    <p className="mt-2 text-sm leading-relaxed text-muted">{review.comment}</p>
                    {review.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {review.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {t(`reviews.tags.${tag}`)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {review.workshopReply ? (
                      <div className="mt-3 rounded-input border-l-2 border-accent/50 bg-surface2/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                          {t("console.reply")}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{review.workshopReply}</p>
                        <p className="mt-1 text-[10px] text-faint">
                          {review.repliedAt ? formatDate(review.repliedAt) : ""}
                        </p>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          setReplying(review);
                          setReply("");
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> {t("console.reply")}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>{t("console.rating")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="font-heading text-4xl font-semibold text-fg">{summary.avg.toFixed(1)}</p>
                  <StarRating value={summary.avg} size="sm" className="mt-1 justify-center" />
                  <p className="mt-1 text-[11px] text-faint">
                    {reviews.length} {t("console.reviews")}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = summary.distribution[star as 1 | 2 | 3 | 4 | 5];
                    const percent = reviews.length ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-[10px] text-faint">
                        <span className="w-3">{star}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface3">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="w-4 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      <Dialog open={Boolean(replying)} onOpenChange={(open) => !open && setReplying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("console.replyTitle")}</DialogTitle>
            <DialogDescription>{t("console.replyBody")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={t("console.replyPlaceholder")}
            rows={4}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReplying(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={replyReview.isPending || reply.trim().length < 3}
              onClick={async () => {
                if (!replying) return;
                try {
                  await replyReview.mutateAsync({ id: replying.id, body: reply.trim() });
                  toast.success(t("console.replySent"));
                  setReplying(null);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              {replyReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              {t("console.reply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
