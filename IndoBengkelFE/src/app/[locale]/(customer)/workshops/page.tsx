"use client";

import {
  ArrowRight,
  Compass,
  LocateFixed,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPanel } from "@/components/domain/map-panel";
import type { MapMarker } from "@/components/domain/leaflet-map";
import { WorkshopCard } from "@/components/domain/workshop-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useWorkshops } from "@/lib/api/hooks";
import type { WorkshopType } from "@/lib/api/types";
import { formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";

const JAKARTA = { lat: -6.2088, lng: 106.8456 };

const CITY_OPTIONS = [
  { name: "Jakarta", lat: -6.2088, lng: 106.8456 },
  { name: "Bandung", lat: -6.9175, lng: 107.6191 },
  { name: "Surabaya", lat: -7.2575, lng: 112.7521 },
  { name: "Yogyakarta", lat: -7.7956, lng: 110.3695 },
  { name: "Semarang", lat: -6.9667, lng: 110.4167 },
  { name: "Denpasar", lat: -8.65, lng: 115.2167 },
  { name: "Medan", lat: 3.5952, lng: 98.6722 },
  { name: "Makassar", lat: -5.1477, lng: 119.4327 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869 },
  { name: "Bangkok", lat: 13.7563, lng: 100.5018 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
];

function DiscoverContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as WorkshopType | null) ?? "all";
  const initialQuery = searchParams.get("q") ?? "";

  const [q, setQ] = useState(initialQuery);
  const [type, setType] = useState<WorkshopType | "all">(initialType);
  const [openNow, setOpenNow] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<"nearest" | "rating" | "name">("nearest");
  const [radius, setRadius] = useState(0);
  const [coords, setCoords] = useState(JAKARTA);
  const [locationLabel, setLocationLabel] = useState("Jakarta");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("list");

  const query = useWorkshops({
    q: q || undefined,
    type,
    openNow,
    minRating: minRating || undefined,
    sort,
    radius: radius || undefined,
    lat: coords.lat,
    lng: coords.lng,
    perPage: 50,
  });

  const workshops = query.data?.data ?? [];
  const selected = workshops.find((workshop) => workshop.id === selectedId) ?? workshops[0];
  const markers = useMemo<MapMarker[]>(
    () =>
      workshops.map((workshop) => ({
        id: workshop.id,
        lat: workshop.lat,
        lng: workshop.lng,
        label: `${workshop.name} · ${workshop.ratingAvg.toFixed(1)}`,
        active: workshop.id === selected?.id,
        onClick: () => setSelectedId(workshop.id),
      })),
    [selected?.id, workshops],
  );

  const filteredCities = CITY_OPTIONS.filter((city) =>
    city.name.toLowerCase().includes(locationQuery.toLowerCase()),
  );

  const useLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("discover.locationUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationLabel(t("discover.usingLocation"));
        setLocationQuery("");
        toast.success(t("toasts.locationUpdated"));
      },
      () => toast.error(t("discover.locationDenied")),
      { timeout: 8_000 },
    );
  };

  const clearFilters = () => {
    setQ("");
    setType("all");
    setOpenNow(false);
    setMinRating(0);
    setSort("nearest");
    setRadius(0);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.discover")}
        title={t("discover.title")}
        description={t("discover.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="accent">{t("discover.resultsCount", { count: query.data?.meta?.total ?? workshops.length })}</Badge>
            <div className="inline-flex rounded-pill border border-line bg-surface p-1 lg:hidden">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn("rounded-pill px-3 py-1 text-[11px] font-medium", view === "list" ? "bg-surface2 text-fg" : "text-muted")}
              >
                {t("discover.list")}
              </button>
              <button
                type="button"
                onClick={() => setView("map")}
                className={cn("rounded-pill px-3 py-1 text-[11px] font-medium", view === "map" ? "bg-surface2 text-fg" : "text-muted")}
              >
                {t("discover.map")}
              </button>
            </div>
          </div>
        }
      />

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("discover.searchPlaceholder")}
              className="pl-9"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:bg-surface2 hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="relative flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setLocationOpen((open) => !open)}
                className="inline-flex h-10 w-full items-center gap-2 rounded-input border border-line bg-surface px-3 text-xs text-muted hover:border-lineStrong hover:text-fg sm:w-52"
              >
                <MapPin className="h-3.5 w-3.5 text-accent" />
                <span className="truncate">{locationLabel}</span>
              </button>
              {locationOpen ? (
                <div className="absolute right-0 top-12 z-30 w-72 rounded-card border border-line bg-surface p-2 shadow-float">
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                    <Input
                      value={locationQuery}
                      onChange={(event) => setLocationQuery(event.target.value)}
                      placeholder={t("common.searchCity")}
                      className="h-9 pl-8 text-xs"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      useLocation();
                      setLocationOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-left text-xs text-accent hover:bg-surface2"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    {t("common.useMyLocation")}
                  </button>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredCities.map((city) => (
                      <button
                        key={city.name}
                        type="button"
                        onClick={() => {
                          setCoords({ lat: city.lat, lng: city.lng });
                          setLocationLabel(city.name);
                          setLocationQuery("");
                          setLocationOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-input px-2.5 py-2 text-left text-xs text-muted hover:bg-surface2 hover:text-fg"
                      >
                        <span>{city.name}</span>
                        <span className="text-[10px] text-faint">
                          {formatDistance(Math.sqrt((city.lat - coords.lat) ** 2 + (city.lng - coords.lng) ** 2) * 111)}
                        </span>
                      </button>
                    ))}
                    {filteredCities.length === 0 ? (
                      <p className="px-2.5 py-3 text-xs text-faint">{t("common.noResults")}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <Button variant="secondary" size="icon" onClick={useLocation} aria-label={t("common.useMyLocation")}>
              <LocateFixed className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t("discover.filters")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "motor", "mobil"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setType(item)}
                className={cn(
                  "rounded-full border px-2.5 py-1.5 text-[11px] font-medium",
                  type === item
                    ? "border-accent/40 bg-accent/12 text-accent"
                    : "border-line bg-surface text-muted hover:text-fg",
                )}
              >
                {item === "all" ? t("discover.anyType") : item === "motor" ? t("home.motor") : t("home.mobil")}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted">
            <Switch checked={openNow} onCheckedChange={setOpenNow} label={t("discover.openNowOnly")} />
            {t("discover.openNowOnly")}
          </label>
          <Select
            value={String(minRating)}
            onChange={(event) => setMinRating(Number(event.target.value))}
            className="h-8 w-auto rounded-pill text-[11px]"
          >
            <option value="0">{t("discover.rating")}: {t("common.all")}</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
          </Select>
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="h-8 w-auto rounded-pill text-[11px]"
          >
            <option value="nearest">{t("discover.nearest")}</option>
            <option value="rating">{t("discover.topRated")}</option>
            <option value="name">{t("discover.name")}</option>
          </Select>
          <Select
            value={String(radius)}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="h-8 w-auto rounded-pill text-[11px]"
          >
            <option value="0">{t("discover.radius")}: {t("common.all")}</option>
            <option value="5">≤ 5 km</option>
            <option value="10">≤ 10 km</option>
            <option value="25">≤ 25 km</option>
            <option value="50">≤ 50 km</option>
          </Select>
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-[11px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            {t("discover.clearFilters")}
          </button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className={cn("order-2 space-y-3 lg:order-1", view === "list" ? "hidden lg:block" : "block")}>
          <div className="h-[420px] overflow-hidden rounded-card border border-line bg-surface sm:h-[520px]">
            <MapPanel center={coords} zoom={12} markers={markers} className="h-full" />
          </div>
          {selected ? (
            <Card className="p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-faint">{t("discover.selectedWorkshop")}</p>
                  <p className="mt-1 truncate font-heading text-sm font-semibold text-fg">{selected.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {selected.addressLine} · {formatDistance(selected.distanceKm)}
                  </p>
                </div>
                <Badge variant="accent">
                  <Star className="h-3 w-3" /> {selected.ratingAvg.toFixed(1)}
                </Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link href={`/workshops/${selected.slug}`}>
                    {t("discover.viewDetails")} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/workshops/${selected.slug}/book`}>{t("discover.book")}</Link>
                </Button>
              </div>
            </Card>
          ) : null}
        </div>

        <div className={cn("order-1 space-y-3 lg:order-2", view === "map" ? "hidden lg:block" : "block")}>
          {query.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="rounded-card border border-line bg-surface p-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="mt-3 h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : workshops.length === 0 ? (
            <EmptyState
              icon={Compass}
              title={t("discover.noResults")}
              description={t("discover.noResultsBody")}
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  {t("discover.clearFilters")}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {workshops.map((workshop) => (
                <div key={workshop.id} onMouseEnter={() => setSelectedId(workshop.id)}>
                  <WorkshopCard workshop={workshop} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card border border-line bg-surface" />}>
      <DiscoverContent />
    </Suspense>
  );
}
