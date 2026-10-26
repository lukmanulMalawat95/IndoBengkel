"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Review } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { maskName } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";

export function ReviewCard({ review, compact = false }: { review: Review; compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("workshop");

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <Avatar name={review.customerName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium text-fg">{maskName(review.customerName)}</p>
            <span className="text-[11px] text-faint">{formatDate(review.createdAt, locale as "en" | "id")}</span>
          </div>
          <StarRating value={review.rating} size="xs" className="mt-1" />
          <p className="mt-2 text-sm leading-relaxed text-muted">{review.comment}</p>
          {review.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {review.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="capitalize">
                  {tag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          ) : null}
          {review.workshopReply && !compact ? (
            <div className="mt-3 rounded-input border-l-2 border-accent/50 bg-surface2/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                {t("reply")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{review.workshopReply}</p>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
