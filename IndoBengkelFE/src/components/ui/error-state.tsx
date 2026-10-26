"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./button";

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const t = useTranslations("states");
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-danger/25 bg-danger/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-6 w-6 text-danger" />
      <h3 className="font-heading text-base font-semibold text-fg">{title ?? t("error")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description ?? t("errorBody")}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
