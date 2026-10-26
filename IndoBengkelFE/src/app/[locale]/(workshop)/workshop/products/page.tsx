"use client";

import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ProductDialog } from "@/components/domain/workshop-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteWorkshopProduct,
  useUpdateWorkshopProduct,
  useWorkshopProducts,
} from "@/lib/api/hooks";
import type { Product } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";

export default function WorkshopProductsPage() {
  const t = useTranslations();
  const productsQuery = useWorkshopProducts();
  const updateProduct = useUpdateWorkshopProduct();
  const deleteProduct = useDeleteWorkshopProduct();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  if (productsQuery.isLoading) return <PageLoading />;
  if (productsQuery.isError) return <ErrorState onRetry={() => productsQuery.refetch()} />;

  const products = productsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.products")}
        title={t("console.products")}
        description={t("console.productsSubtitle")}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("console.addProduct")}
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("console.noProducts")}
          description={t("console.noProductsBody")}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> {t("console.addProduct")}
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <ImageWithFallback
                src={product.imageUrl}
                alt={product.title}
                className="h-16 w-16 shrink-0 rounded-input"
                sizes="64px"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-fg">{product.title}</p>
                  <Badge variant={product.isActive ? "success" : "default"}>
                    {product.isActive ? t("console.active") : t("console.inactive")}
                  </Badge>
                  {product.discountType !== "none" ? (
                    <Badge variant="lime">
                      {t("shop.discount", {
                        percent:
                          product.discountType === "fixed"
                            ? Math.round((product.discountValue / product.price) * 100)
                            : product.discountValue,
                      })}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  {t(`shop.categoryLabels.${product.category}`)} · {product.brand || "—"} ·{" "}
                  {product.partNumber || "—"}
                </p>
                <p className="mt-1 text-[11px] text-faint">
                  {t("common.stock")}: {product.stock} · {t("common.weight")}: {product.weightGrams} g
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="text-right">
                  {product.discountType !== "none" ? (
                    <p className="text-[10px] text-faint line-through">{formatCurrency(product.price)}</p>
                  ) : null}
                  <p className="font-heading text-sm font-semibold text-fg">
                    {formatCurrency(product.finalPrice)}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  <Switch
                    checked={product.isActive}
                    onCheckedChange={(checked) =>
                      updateProduct.mutate({ id: product.id, values: { isActive: checked } })
                    }
                  />
                </label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(product);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-danger"
                    onClick={() => setDeleting(product)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.delete")}</DialogTitle>
            <DialogDescription>{t("console.deleteProductConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={deleteProduct.isPending}
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteProduct.mutateAsync(deleting.id);
                  toast.success(t("toasts.deleted"));
                  setDeleting(null);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("toasts.error"));
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
