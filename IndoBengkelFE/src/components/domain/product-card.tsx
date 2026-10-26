"use client";

import { Plus, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Product } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

export function ProductCard({
  product,
  onOpen,
  onAdd,
  className,
}: {
  product: Product;
  onOpen?: (product: Product) => void;
  onAdd?: (product: Product) => void;
  className?: string;
}) {
  const t = useTranslations("shop");
  const discount =
    product.discountType === "percent"
      ? product.discountValue
      : product.discountType === "fixed"
        ? Math.round((product.discountValue / product.price) * 100)
        : 0;

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-lineStrong",
        className,
      )}
    >
      <button type="button" onClick={() => onOpen?.(product)} className="text-left">
        <div className="relative h-36 overflow-hidden">
          <ImageWithFallback
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full"
            imageClassName="transition-transform duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
            <Badge variant="default" className="bg-black/45 text-white backdrop-blur">
              {t(`categoryLabels.${product.category}`)}
            </Badge>
            {discount > 0 ? (
              <Badge variant="lime" className="bg-lime text-[#10140D]">
                -{discount}%
              </Badge>
            ) : null}
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <button type="button" onClick={() => onOpen?.(product)} className="text-left">
          <h3 className="line-clamp-2 min-h-9 font-heading text-sm font-semibold leading-snug tracking-tight text-fg">
            {product.title}
          </h3>
        </button>
        <p className="truncate text-[11px] text-muted">{product.brand} · {product.workshopName}</p>
        <div className="flex items-center gap-1 text-[10px] text-muted">
          <Star className="h-3 w-3 fill-accent text-accent" />
          {product.ratingAvg.toFixed(1)} <span className="text-faint">({product.ratingCount})</span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <p className="font-heading text-sm font-semibold text-fg">{formatCurrency(product.finalPrice)}</p>
            {product.finalPrice < product.price ? (
              <p className="text-[10px] text-faint line-through">{formatCurrency(product.price)}</p>
            ) : null}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant={product.stock > 0 ? "default" : "secondary"}
            disabled={product.stock <= 0}
            onClick={() => onAdd?.(product)}
            aria-label={t("addToCart")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
