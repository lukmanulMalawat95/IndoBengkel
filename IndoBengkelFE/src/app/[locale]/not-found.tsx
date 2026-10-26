"use client";

import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("states");
  const tn = useTranslations("nav");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md p-8 text-center">
        <Compass className="mx-auto h-9 w-9 text-accent" />
        <p className="mt-4 font-heading text-5xl font-semibold tracking-tight text-fg">404</p>
        <h1 className="mt-2 font-heading text-lg font-semibold text-fg">{t("notFound")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("notFoundBody")}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button asChild>
            <Link href="/">{tn("home")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/workshops">{tn("discover")}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
