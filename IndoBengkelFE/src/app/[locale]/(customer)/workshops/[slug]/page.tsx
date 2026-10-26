"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Star,
  Wrench,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPanel } from "@/components/domain/map-panel";
import { ProductCard } from "@/components/domain/product-card";
import { ProductDrawer } from "@/components/domain/product-drawer";
import { ReviewCard } from "@/components/domain/review-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageLoading } from "@/components/ui/page-loading";
import { StarRating } from "@/components/ui/star-rating";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import {
  useAddToCart,
  useProducts,
  useStartConversation,
  useWorkshop,
} from "@/lib/api/hooks";
import type { Product } from "@/lib/api/types";
import { formatCurrency, formatDistance, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function WorkshopDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const workshopQuery = useWorkshop(slug);
  const workshop = workshopQuery.data;
  const productsQuery = useProducts({ workshopId: workshop?.id, perPage: 8 });
  const addToCart = useAddToCart();
  const startConversation = useStartConversation();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const products = productsQuery.data?.data ?? workshop?.products ?? [];
  const reviews = workshop?.reviews ?? [];
  const distribution = useMemo(() => {
    const result = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      result[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
    });
    return result;
  }, [reviews]);

  if (workshopQuery.isLoading) return <PageLoading />;
  if (workshopQuery.isError || !workshop) {
    return <ErrorState title={t("workshop.workshopNotFound")} onRetry={() => workshopQuery.refetch()} />;
  }

  const paidPrices = workshop.services
    .filter((service) => service.price > 0)
    .map((service) => service.price);
  const minPrice = paidPrices.length ? Math.min(...paidPrices) : 0;

  const handleAdd = async (product: Product, qty = 1) => {
    if (!user) {
      router.push(`/auth/login?returnTo=/workshops/${slug}`);
      return;
    }
    try {
      await addToCart.mutateAsync({ workshopId: product.workshopId, productId: product.id, qty });
      toast.success(t("toasts.addedToCart"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const handleChat = async () => {
    if (!user) {
      router.push(`/auth/login?returnTo=/workshops/${slug}`);
      return;
    }
    try {
      const conversation = await startConversation.mutateAsync(workshop.id);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/workshops"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("discover.title")}
      </Link>

      {workshop.status === "suspended" ? (
        <div className="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {t("console.suspendedBody")}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="relative h-56 sm:h-72 lg:h-80">
          <ImageWithFallback
            src={workshop.coverUrl}
            alt={workshop.name}
            className="h-full w-full"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-1.5 sm:left-6 sm:top-6">
            <Badge variant={workshop.openNow ? "success" : "default"} className="backdrop-blur">
              <span className={cn("h-1.5 w-1.5 rounded-full", workshop.openNow ? "bg-success" : "bg-muted")} />
              {workshop.openNow ? t("home.openNow") : t("home.closedNow")}
            </Badge>
            <Badge variant="default" className="backdrop-blur">
              {workshop.workshopType === "motor" ? t("home.motor") : t("home.mobil")}
            </Badge>
            <Badge variant="accent" className="backdrop-blur">
              <ShieldCheck className="h-3 w-3" /> {t("workshop.verified")}
            </Badge>
            {workshop.status !== "active" ? <StatusBadge kind="workshop" status={workshop.status} /> : null}
          </div>
          <div className="absolute inset-x-4 bottom-4 text-white sm:inset-x-6 sm:bottom-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
              {workshop.city} · {t("workshop.since", { year: new Date(workshop.createdAt).getFullYear() })}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-4xl">
              {workshop.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/80">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-lime text-lime" />
                <span className="font-semibold text-white">{workshop.ratingAvg.toFixed(1)}</span>
                ({workshop.ratingCount})
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {workshop.addressLine}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {workshop.nextSlot
                  ? `${t("home.nextSlot")} · ${formatTime(workshop.nextSlot, locale as "en" | "id")}`
                  : t("workshop.closedToday")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="font-heading text-base font-semibold text-fg">
              {minPrice ? t("workshop.fromPrice", { price: formatCurrency(minPrice) }) : "—"}
            </span>
            {workshop.distanceKm !== undefined ? (
              <span className="rounded-full border border-line bg-surface2 px-2.5 py-1">
                {formatDistance(workshop.distanceKm)}
              </span>
            ) : null}
            <span className="rounded-full border border-line bg-surface2 px-2.5 py-1">
              {t("common.pickupOrDelivery")}
            </span>
          </div>
          <div className="flex gap-2">
            <Button asChild className="flex-1 sm:flex-none">
              <Link href={`/workshops/${workshop.slug}/book`}>
                <CalendarClock className="h-4 w-4" />
                {t("workshop.bookService")}
              </Link>
            </Button>
            <Button variant="secondary" onClick={handleChat} disabled={startConversation.isPending}>
              <MessageSquare className="h-4 w-4" />
              {t("workshop.chatWithWorkshop")}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <Tabs defaultValue="services">
            <TabsList className="no-scrollbar max-w-full overflow-x-auto">
              <TabsTrigger value="services">{t("workshop.services")}</TabsTrigger>
              <TabsTrigger value="shop">{t("workshop.shop")}</TabsTrigger>
              <TabsTrigger value="reviews">{t("workshop.reviews")}</TabsTrigger>
              <TabsTrigger value="mechanics">{t("workshop.mechanics")}</TabsTrigger>
              <TabsTrigger value="about">{t("workshop.about")}</TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="mt-4 space-y-3">
              {workshop.services.length === 0 ? (
                <Card className="p-6 text-sm text-muted">{t("workshop.noServices")}</Card>
              ) : (
                workshop.services.map((service) => (
                  <Card key={service.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full chip-accent">
                            <Wrench className="h-4 w-4" />
                          </span>
                          <h3 className="font-heading text-sm font-semibold text-fg">{service.name}</h3>
                        </div>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-faint">
                          {t(`serviceCategories.${service.category}`)} · {t(`serviceKinds.${service.kind}`)}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-muted">{service.description}</p>
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-faint">
                          <Clock3 className="h-3 w-3" /> {t("workshop.duration", { minutes: service.durationMinutes })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <p className="font-heading text-base font-semibold text-fg">
                          {service.price === 0 ? t("booking.free") : formatCurrency(service.price)}
                        </p>
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/workshops/${workshop.slug}/book?service=${service.id}`}>
                            {t("workshop.book")} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="shop" className="mt-4">
              {products.length === 0 ? (
                <Card className="p-6 text-sm text-muted">{t("workshop.noProducts")}</Card>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpen={(item) => {
                        setSelectedProduct(item);
                        setDrawerOpen(true);
                      }}
                      onAdd={(item) => handleAdd(item, 1)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="mt-4 space-y-4">
              <Card className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-heading text-4xl font-semibold text-fg">{workshop.ratingAvg.toFixed(1)}</p>
                      <StarRating value={workshop.ratingAvg} size="sm" className="mt-1" />
                      <p className="mt-1 text-[11px] text-faint">
                        {t("workshop.reviewCount", { count: workshop.ratingCount })}
                      </p>
                    </div>
                    <div className="min-w-32 flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = distribution[star as 1 | 2 | 3 | 4 | 5];
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
                  </div>
                </div>
              </Card>
              {reviews.length === 0 ? (
                <Card className="p-6 text-sm text-muted">{t("workshop.noReviews")}</Card>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="mechanics" className="mt-4">
              {workshop.mechanics.length === 0 ? (
                <Card className="p-6 text-sm text-muted">{t("workshop.noMechanics")}</Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {workshop.mechanics.map((mechanic) => (
                    <Card key={mechanic.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <ImageWithFallback
                          src={mechanic.photoUrl}
                          alt={mechanic.name}
                          className="h-12 w-12 rounded-full"
                          sizes="48px"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">{mechanic.name}</p>
                          <p className="text-[11px] text-muted">
                            {mechanic.experienceYears} {t("common.years")} · {t("common.experience")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {mechanic.skills.map((skill) => (
                          <Badge key={skill} variant="outline">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="about" className="mt-4 space-y-4">
              <Card className="p-5">
                <h2 className="font-heading text-base font-semibold text-fg">{workshop.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{workshop.description}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info icon={MapPin} label={t("workshop.address")} value={`${workshop.addressLine}, ${workshop.city}`} />
                  <Info icon={Phone} label={t("workshop.phone")} value={workshop.phone} />
                  <Info icon={Clock3} label={t("workshop.capacity")} value={`${workshop.slotCapacityPerHour} ${t("workshop.slot")}/h`} />
                  <Info icon={CheckCircle2} label={t("common.type")} value={workshop.workshopType === "motor" ? t("home.motor") : t("home.mobil")} />
                </div>
              </Card>
              <Card className="overflow-hidden">
                <div className="h-56">
                  <MapPanel
                    center={{ lat: workshop.lat, lng: workshop.lng }}
                    zoom={15}
                    interactive={false}
                    markers={[
                      {
                        id: workshop.id,
                        lat: workshop.lat,
                        lng: workshop.lng,
                        label: workshop.name,
                        active: true,
                      },
                    ]}
                  />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("workshop.openingHours")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workshop.hours.map((hours) => {
                const label = new Date(2024, 0, 7 + hours.dayOfWeek).toLocaleDateString(
                  locale === "id" ? "id-ID" : "en-US",
                  { weekday: "long" },
                );
                return (
                  <div key={hours.dayOfWeek} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted">{label}</span>
                    <span className={hours.isClosed ? "text-danger" : "text-fg"}>
                      {hours.isClosed ? t("workshop.closed") : `${hours.openTime}–${hours.closeTime}`}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("workshop.address")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted">
              <p>{workshop.addressLine}</p>
              <p>{workshop.city}, {workshop.province} {workshop.postalCode}</p>
              <a href={`tel:${workshop.phone}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                <Phone className="h-3.5 w-3.5" /> {workshop.phone}
              </a>
              <Button asChild variant="secondary" size="sm" className="w-full">
                <Link href={`/workshops/${workshop.slug}/book`}>
                  <CalendarClock className="h-4 w-4" /> {t("workshop.bookService")}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <ShoppingBag className="h-4 w-4 text-accent" />
              <span>{t("common.pickupOrDelivery")} · {t("common.idrOnly")}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">{t("cart.pickupNote")}</p>
          </Card>
        </aside>
      </div>

      <ProductDrawer
        product={selectedProduct}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAdd={(product, qty) => handleAdd(product, qty)}
      />
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-input border border-line bg-surface2/50 p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 text-xs text-fg">{value}</p>
    </div>
  );
}
