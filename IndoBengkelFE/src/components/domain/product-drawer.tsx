"use client";

import { Minus, Plus, ShoppingBag, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Product } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { Price } from "@/components/ui/price";

export function ProductDrawer({
  product,
  open,
  onOpenChange,
  onAdd,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (product: Product, qty: number) => void;
}) {
  const t = useTranslations("shop");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setQty(1);
  }, [product?.id]);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-full max-h-none w-full max-w-md translate-x-0 translate-y-0 overflow-y-auto rounded-none border-y-0 border-r-0 p-0 sm:rounded-l-card">
        <div className="relative h-56 overflow-hidden sm:h-64">
          <ImageWithFallback
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full"
            sizes="(max-width: 768px) 100vw, 420px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 flex gap-1.5">
            <Badge variant="default" className="bg-black/45 text-white backdrop-blur">
              {t(`categoryLabels.${product.category}`)}
            </Badge>
            {product.stock > 0 ? (
              <Badge variant="success" className="backdrop-blur">
                {t("inStock")}
              </Badge>
            ) : (
              <Badge variant="danger">{t("outOfStock")}</Badge>
            )}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <DialogHeader className="mb-0">
            <DialogTitle className="text-xl leading-tight">{product.title}</DialogTitle>
            <DialogDescription>
              {product.brand} · {product.workshopName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              {product.ratingAvg.toFixed(1)} ({product.ratingCount})
            </span>
            <span className="text-xs text-faint">·</span>
            <span className="text-xs text-muted">
              {t("pickupAt", { workshop: product.workshopName })}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3 rounded-card border border-line bg-surface2 p-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-faint">{t("price")}</p>
              <Price value={product.finalPrice} original={product.price} size="lg" />
            </div>
            {product.stock > 0 ? (
              <Badge variant="outline">
                {product.stock <= 5 ? t("lowStock", { count: product.stock }) : t("inStock")}
              </Badge>
            ) : null}
          </div>

          <p className="text-sm leading-relaxed text-muted">{product.description}</p>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Meta label={t("partNumber")} value={product.partNumber} />
            <Meta label={t("brand")} value={product.brand} />
            <Meta label={t("weight")} value={`${product.weightGrams} g`} />
            <Meta label={t("workshop")} value={product.workshopName} />
          </dl>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted">{t("quantity")}</span>
            <div className="inline-flex items-center rounded-full border border-line bg-surface">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center text-muted hover:text-fg disabled:opacity-40"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                disabled={qty <= 1}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-medium">{qty}</span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center text-muted hover:text-fg disabled:opacity-40"
                onClick={() => setQty((value) => Math.min(product.stock, value + 1))}
                disabled={qty >= product.stock}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={product.stock <= 0}
              onClick={() => {
                onAdd(product, qty);
                onOpenChange(false);
              }}
            >
              <ShoppingBag className="h-4 w-4" />
              {t("addToCart")} · {formatCurrency(product.finalPrice * qty)}
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/workshops/${product.workshopSlug}`}>{t("viewWorkshop")}</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-input border border-line bg-surface2/60 p-2.5">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className="mt-1 truncate text-xs text-fg">{value || "—"}</dd>
    </div>
  );
}
