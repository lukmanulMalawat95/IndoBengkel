"use client";

import { ArrowUpRight, Clock3, MapPin, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Workshop } from "@/lib/api/types";
import { formatDistance, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { StarRating } from "@/components/ui/star-rating";

export function WorkshopCard({ workshop, className }: { workshop: Workshop; className?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const paidPrices = workshop.services
    .filter((service) => service.price > 0)
    .map((service) => service.price);
  const minPrice = paidPrices.length ? Math.min(...paidPrices) : 0;
  const nextSlot = workshop.nextSlot ? new Date(workshop.nextSlot) : null;
  const nextLabel = nextSlot
    ? `${nextSlot.toDateString() === new Date().toDateString() ? t("common.today") : t("common.tomorrow")} · ${formatTime(nextSlot, locale as "en" | "id")}`
    : t("common.closed");

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-lineStrong",
        className,
      )}
    >
      <Link href={`/workshops/${workshop.slug}`} className="block">
        <div className="relative h-40 overflow-hidden sm:h-44">
          <ImageWithFallback
            src={workshop.coverUrl}
            alt={workshop.name}
            className="h-full w-full"
            imageClassName="transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <Badge variant={workshop.openNow ? "success" : "default"} className="backdrop-blur">
              <span className={cn("h-1.5 w-1.5 rounded-full", workshop.openNow ? "bg-success" : "bg-muted")} />
              {workshop.openNow ? t("home.openNow") : t("home.closedNow")}
            </Badge>
            <Badge variant="default" className="backdrop-blur">
              {workshop.workshopType === "motor" ? t("home.motor") : t("home.mobil")}
            </Badge>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-heading text-base font-semibold tracking-tight text-white">
                {workshop.name}
              </h3>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/75">
                <MapPin className="h-3 w-3" />
                {workshop.city} · {workshop.addressLine.split(",")[0]}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <Star className="h-3 w-3 fill-lime text-lime" />
              {workshop.ratingAvg.toFixed(1)}
            </span>
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <StarRating value={workshop.ratingAvg} size="xs" />
          <span className="text-[11px] text-muted">
            {t("home.reviewsCount", { count: workshop.ratingCount })}
          </span>
          <span className="ml-auto text-[11px] font-medium text-fg">
            {formatDistance(workshop.distanceKm)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Clock3 className="h-3.5 w-3.5 text-accent" />
          <span>
            {t("home.nextSlot")}: <span className="text-fg">{nextLabel}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {workshop.services.slice(0, 2).map((service) => (
            <span
              key={service.id}
              className="rounded-full border border-line bg-surface2 px-2 py-1 text-[10px] text-muted"
            >
              {service.name}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-faint">{t("common.from")}</p>
            <p className="font-heading text-sm font-semibold text-fg">
              {minPrice ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(minPrice) : "—"}
            </p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/workshops/${workshop.slug}`}>
              {t("common.viewDetails")}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
