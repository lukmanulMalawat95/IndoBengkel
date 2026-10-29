"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Bottom-right pagination with previous/next controls and a typeable page
 * number. Typing a number and pressing Enter (or leaving the field) navigates
 * to that page; values are clamped to the available range.
 */
export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  const t = useTranslations("common");
  const [draft, setDraft] = useState(String(page));
  const cancelBlurRef = useRef(false);
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotal);

  useEffect(() => {
    setDraft(String(safePage));
  }, [safePage]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(safePage));
      return;
    }
    const next = Math.min(safeTotal, Math.max(1, parsed));
    setDraft(String(next));
    if (next !== safePage) onPageChange(next);
  };

  return (
    <nav
      aria-label={t("pagination")}
      className={cn("flex items-center justify-end gap-2", className)}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={t("previousPage")}
        disabled={safePage <= 1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onPageChange(safePage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span>{t("page")}</span>
        <Input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => {
            if (cancelBlurRef.current) {
              cancelBlurRef.current = false;
              return;
            }
            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              cancelBlurRef.current = true;
              setDraft(String(safePage));
              event.currentTarget.blur();
            }
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={t("page")}
          className="h-8 w-14 px-2 text-center tabular-nums"
        />
        <span>
          {t("of")} {safeTotal}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={t("nextPage")}
        disabled={safePage >= safeTotal}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onPageChange(safePage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
