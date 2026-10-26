"use client";

import { Loader2, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StarRatingInput } from "@/components/domain/star-rating-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReviewProduct, useReviewWorkshop } from "@/lib/api/hooks";
import type { ReviewTag } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const tags: ReviewTag[] = ["fair_price", "fast", "honest", "clean", "friendly"];

export function ReviewDialog({
  open,
  onOpenChange,
  target,
  serviceOrderId,
  orderId,
  productId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: "workshop" | "product";
  serviceOrderId?: string;
  orderId?: string;
  productId?: string;
  onSubmitted?: () => void;
}) {
  const t = useTranslations();
  const reviewWorkshop = useReviewWorkshop();
  const reviewProduct = useReviewProduct();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<ReviewTag[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setRating(5);
      setComment("");
      setSelectedTags([]);
      setError("");
    }
  }, [open]);

  const pending = reviewWorkshop.isPending || reviewProduct.isPending;

  const submit = async () => {
    const trimmed = comment.trim();
    if (trimmed.length > 0 && trimmed.length < 10) {
      setError(t("reviews.commentMin"));
      return;
    }
    try {
      const input = {
        target,
        serviceOrderId,
        orderId,
        productId,
        rating,
        comment: trimmed,
        tags: selectedTags,
      } as const;
      if (target === "workshop") await reviewWorkshop.mutateAsync(input);
      else await reviewProduct.mutateAsync(input);
      toast.success(t("toasts.reviewSubmitted"));
      onOpenChange(false);
      onSubmitted?.();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toasts.error");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target === "workshop" ? t("bookings.reviewTitle") : t("reviews.reviewProductTitle")}
          </DialogTitle>
          <DialogDescription>
            {target === "workshop" ? t("bookings.reviewBody") : t("reviews.reviewProductBody")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface2/50 p-3">
            <StarRatingInput value={rating} onChange={setRating} />
            <span className="text-xs text-muted">{t("reviews.rating")} {rating}/5</span>
          </div>

          <Field label={t("reviews.comment")} hint={t("common.optional")}>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("reviews.commentPlaceholder")}
              maxLength={500}
              rows={4}
            />
          </Field>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
              {t("reviews.tagsLabel")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setSelectedTags((current) =>
                        active ? current.filter((item) => item !== tag) : [...current, tag],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1.5 text-[11px] transition-colors",
                      active
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-line bg-surface text-muted hover:text-fg",
                    )}
                  >
                    {t(`reviews.tags.${tag}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            {t("reviews.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
