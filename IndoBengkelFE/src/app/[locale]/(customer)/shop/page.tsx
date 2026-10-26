"use client";

import { PackageSearch, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ProductCard } from "@/components/domain/product-card";
import { ProductDrawer } from "@/components/domain/product-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { useAddToCart, useCarts, useProducts } from "@/lib/api/hooks";
import type { Product, ProductCategory, WorkshopType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const categories: (ProductCategory | "all")[] = [
  "all",
  "sparepart",
  "oil",
  "accessories",
  "tools",
  "other",
];

export default function ShopPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [type, setType] = useState<WorkshopType | "all">("all");
  const [sort, setSort] = useState<"rating" | "newest" | "price_asc" | "price_desc">("rating");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const productsQuery = useProducts({ q: q || undefined, category, workshopType: type, sort, perPage: 48 });
  const cartsQuery = useCarts(Boolean(user));
  const addToCart = useAddToCart();
  const products = productsQuery.data?.data ?? [];
  const cartCount =
    cartsQuery.data?.reduce(
      (total, cart) => total + cart.items.reduce((count, item) => count + item.qty, 0),
      0,
    ) ?? 0;

  const handleAdd = async (product: Product, qty = 1) => {
    if (!user) {
      router.push("/auth/login?returnTo=/shop");
      return;
    }
    try {
      await addToCart.mutateAsync({ workshopId: product.workshopId, productId: product.id, qty });
      toast.success(t("toasts.addedToCart"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toasts.error"));
    }
  };

  const clearFilters = () => {
    setQ("");
    setCategory("all");
    setType("all");
    setSort("rating");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.shop")}
        title={t("shop.title")}
        description={t("shop.subtitle")}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/cart">
              <ShoppingBag className="h-4 w-4" />
              {t("cart.title")}
              {cartCount > 0 ? <Badge variant="accent">{cartCount}</Badge> : null}
            </Link>
          </Button>
        }
      />

      <Card className="p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("shop.searchPlaceholder")}
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

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t("shop.category")}
          </span>
          <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-medium",
                  category === item
                    ? "border-accent/40 bg-accent/12 text-accent"
                    : "border-line bg-surface text-muted hover:text-fg",
                )}
              >
                {item === "all" ? t("shop.allCategories") : t(`shop.categoryLabels.${item}`)}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              className="h-8 w-auto rounded-pill text-[11px]"
            >
              <option value="all">{t("shop.allTypes")}</option>
              <option value="motor">{t("home.motor")}</option>
              <option value="mobil">{t("home.mobil")}</option>
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="h-8 w-auto rounded-pill text-[11px]"
            >
              <option value="rating">{t("shop.topRated")}</option>
              <option value="newest">{t("shop.newest")}</option>
              <option value="price_asc">{t("shop.priceAsc")}</option>
              <option value="price_desc">{t("shop.priceDesc")}</option>
            </Select>
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              {t("common.reset")}
            </button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {t("shop.productsCount", { count: productsQuery.data?.meta?.total ?? products.length })}
        </p>
        <Badge variant="outline">{t("common.pickupOrDelivery")}</Badge>
      </div>

      {productsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-card border border-line bg-surface">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : productsQuery.isError ? (
        <ErrorState onRetry={() => productsQuery.refetch()} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t("shop.noProducts")}
          description={t("shop.noProductsBody")}
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              {t("common.resetFilters")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      <ProductDrawer
        product={selectedProduct}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAdd={(product, qty) => handleAdd(product, qty)}
      />
    </div>
  );
}
