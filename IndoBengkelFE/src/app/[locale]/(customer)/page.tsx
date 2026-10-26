"use client";

import {
  Bike,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Search,
  ShieldCheck,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductCard } from "@/components/domain/product-card";
import { ProductDrawer } from "@/components/domain/product-drawer";
import { WorkshopCard } from "@/components/domain/workshop-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import {
  useAddToCart,
  useProducts,
  useVehicles,
  useWorkshops,
} from "@/lib/api/hooks";
import type { Product } from "@/lib/api/types";

const JAKARTA = { lat: -6.2088, lng: 106.8456 };

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const workshopsQuery = useWorkshops({ lat: JAKARTA.lat, lng: JAKARTA.lng, type: "all", sort: "nearest" });
  const productsQuery = useProducts({ sort: "rating", perPage: 4 });
  const vehiclesQuery = useVehicles(Boolean(user));
  const addToCart = useAddToCart();

  const workshops = workshopsQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const nextAvailable = useMemo(() => workshops.slice(0, 3), [workshops]);
  const nearby = workshops.slice(3, 9);
  const reminderVehicle = vehiclesQuery.data?.[0];

  const categories = [
    { href: "/workshops?type=motor", label: t("home.motor"), icon: Bike },
    { href: "/workshops?type=mobil", label: t("home.mobil"), icon: Car },
    { href: "/shop", label: t("nav.shop"), icon: ShoppingBag },
    { href: "/vehicles", label: t("nav.garage"), icon: Wrench },
  ];

  const handleAdd = async (product: Product, qty = 1) => {
    if (!user) {
      toast.info(t("common.signInToContinue"));
      router.push("/auth/login?returnTo=/");
      return;
    }
    try {
      await addToCart.mutateAsync({
        workshopId: product.workshopId,
        productId: product.id,
        qty,
      });
      toast.success(t("toasts.addedToCart"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/workshops${params.size ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      <section>
        <h1 className="sr-only">{t("home.title")}</h1>

        <div className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-3.5 md:flex-row md:items-center md:gap-[22px] md:p-5 md:px-[22px]">
          <form
            onSubmit={submitSearch}
            className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-bg pl-1 pr-1 transition-colors focus-within:border-lineStrong focus-within:ring-2 focus-within:ring-accent/20 md:h-12 md:flex-1 md:gap-2.5 md:px-3.5"
          >
            <Link
              href="/workshops"
              aria-label={t("home.changeLocation")}
              className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted transition-colors hover:text-fg sm:hidden"
            >
              <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden />
              Jakarta
              <ChevronDown className="h-3 w-3 text-faint" aria-hidden />
            </Link>
            <span aria-hidden className="h-4 w-px shrink-0 bg-line sm:hidden" />
            <Search className="hidden h-4 w-4 shrink-0 text-faint sm:block" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("home.searchPlaceholder")}
              aria-label={t("home.searchLabel")}
              className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 text-[13px] focus-visible:ring-0 sm:h-10 sm:text-sm"
            />
            <Button
              type="submit"
              aria-label={t("common.search")}
              className="h-9 w-9 shrink-0 rounded-[9px] px-0 sm:w-auto sm:px-4"
            >
              <Search className="h-4 w-4 sm:hidden" aria-hidden />
              <span className="hidden sm:inline">{t("common.search")}</span>
            </Button>
          </form>

          <span aria-hidden className="h-px w-full bg-line md:h-12 md:w-px" />

          <nav
            aria-label={t("home.categories")}
            className="grid grid-cols-4 gap-1 md:w-[352px] lg:w-[500px]"
          >
            {categories.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 transition-colors duration-200 hover:bg-surface2/70 lg:h-12 lg:flex-row lg:justify-center lg:gap-1.5 lg:px-1.5 lg:py-0"
              >
                <span className="chip-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-transform duration-200 group-hover:-translate-y-0.5 lg:group-hover:translate-y-0">
                  <item.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="text-center text-[10.5px] font-medium leading-none text-muted transition-colors group-hover:text-fg lg:text-left lg:text-[12px]">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {reminderVehicle ? (
        <section className="flex flex-col gap-3 rounded-card border border-warning/25 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-warning/25 bg-warning/10 text-warning">
              <Wrench className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-fg">{t("home.serviceReminder")}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t("home.reminderBody", { vehicle: `${reminderVehicle.brand} ${reminderVehicle.model}` })}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/vehicles/${reminderVehicle.id}`}>{t("home.manageVehicle")}</Link>
          </Button>
        </section>
      ) : null}

      <section>
        <SectionHeading
          title={t("home.nextAvailable")}
          description={t("home.nextAvailableSubtitle")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/workshops">
                {t("common.seeAll")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        {workshopsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="overflow-hidden rounded-card border border-line bg-surface">
                <Skeleton className="h-40 w-full rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : nextAvailable.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nextAvailable.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-muted">
            {t("home.noWorkshopsBody")}
          </div>
        )}
      </section>

      {nearby.length > 0 ? (
        <section>
          <SectionHeading
            title={t("home.nearby")}
            description={t("home.nearbySubtitle")}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/workshops">
                  {t("common.seeAll")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          title={t("home.popularParts")}
          description={t("home.popularPartsSubtitle")}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/shop">
                {t("common.seeAll")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </section>

      <section className="relative overflow-hidden rounded-[20px] border border-line bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent/[0.06] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-lineStrong/70 to-transparent"
        />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface2/60 px-2.5 py-1 text-[11px] font-medium leading-none text-muted">
              <ShieldCheck className="h-3 w-3 text-accent" aria-hidden />
              {t("home.howItWorks")}
            </span>
            <h2 className="mt-3 max-w-lg font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              {t("home.ctaTitle")}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{t("home.ctaBody")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/vehicles">
                  <Wrench className="h-4 w-4" />
                  {t("home.ctaButton")}
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/shop">
                  <ShoppingBag className="h-4 w-4" />
                  {t("nav.shop")}
                </Link>
              </Button>
            </div>
          </div>
          <ol className="relative space-y-2.5">
            <span
              aria-hidden
              className="absolute bottom-6 left-8 top-6 w-px bg-gradient-to-b from-line via-line to-transparent"
            />
            <Step index="01" icon={MapPin} title={t("home.step1Title")} body={t("home.step1Body")} />
            <Step index="02" icon={CalendarClock} title={t("home.step2Title")} body={t("home.step2Body")} />
            <Step index="03" icon={CheckCircle2} title={t("home.step3Title")} body={t("home.step3Body")} />
          </ol>
        </div>
      </section>

      <ProductDrawer
        product={selectedProduct}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAdd={(product, qty) => handleAdd(product, qty)}
      />
    </div>
  );
}

function Step({
  index,
  icon: Icon,
  title,
  body,
}: {
  index: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <li className="relative flex gap-3 rounded-xl border border-line/80 bg-bg/40 p-3.5">
      <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-fg">{title}</p>
          <span className="font-mono text-[10px] tabular-nums text-faint">{index}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{body}</p>
      </div>
    </li>
  );
}
