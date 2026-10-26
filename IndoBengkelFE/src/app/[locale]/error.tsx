"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("states");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-danger/25 p-8 text-center">
        <AlertTriangle className="mx-auto h-9 w-9 text-danger" />
        <h1 className="mt-4 font-heading text-lg font-semibold text-fg">{t("error")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("errorBody")}</p>
        {error.message ? (
          <p className="mt-3 rounded-input border border-line bg-surface2/50 p-2.5 text-[11px] text-faint">
            {error.message}
          </p>
        ) : null}
        <Button className="mt-5" onClick={reset}>
          {t("retry")}
        </Button>
      </Card>
    </div>
  );
}
