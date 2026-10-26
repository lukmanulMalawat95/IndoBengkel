"use client";

import { ArrowRight, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
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
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "@/features/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import {
  useCarts,
  useClearCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from "@/lib/api/hooks";
import { formatCurrency } from "@/lib/format";

export default function CartPage() {
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  const cartsQuery = useCarts(Boolean(user));
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const [clearTarget, setClearTarget] = useState<"all" | string | null>(null);

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("cart.loginRequired")}</h1>
        <p className="mt-1 text-sm text-muted">{t("common.signInToContinue")}</p>
        <Button asChild className="mt-4">
          <Link href="/auth/login?returnTo=/cart">{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (cartsQuery.isLoading) return <PageLoading />;
  if (cartsQuery.isError) return <ErrorState onRetry={() => cartsQuery.refetch()} />;

  const carts = cartsQuery.data ?? [];
  const subtotal = carts.reduce((sum, cart) => sum + cart.subtotal, 0);
  const itemCount = carts.reduce(
    (sum, cart) => sum + cart.items.reduce((count, item) => count + item.qty, 0),
    0,
  );

  if (carts.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t("cart.empty")}
        description={t("cart.emptyBody")}
        action={
          <Button asChild>
            <Link href="/shop">{t("cart.browseShop")}</Link>
          </Button>
        }
      />
    );
  }

  const clearEverything = async () => {
    try {
      if (clearTarget === "all") {
        await Promise.all(carts.map((cart) => clearCart.mutateAsync(cart.workshopId)));
      } else if (clearTarget) {
        await clearCart.mutateAsync(clearTarget);
      }
      setClearTarget(null);
      toast.success(t("toasts.deleted"));
    } catch {
      toast.error(t("toasts.error"));
    }
  };

  const targetName =
    clearTarget === "all"
      ? null
      : carts.find((cart) => cart.workshopId === clearTarget)?.workshopName;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("nav.shop")}</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("cart.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("cart.subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setClearTarget("all")}>
          <Trash2 className="h-4 w-4" /> {t("cart.clearAll")}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {carts.map((cart) => (
            <Card key={cart.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Store className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{cart.workshopName}</p>
                  <p className="text-[11px] text-muted">
                    {t("cart.workshopSubtotal")}: {formatCurrency(cart.subtotal)}
                  </p>
                </div>
                <Link
                  href={`/workshops/${cart.workshopSlug}`}
                  className="ml-auto text-[11px] text-muted hover:text-fg"
                >
                  {t("common.viewDetails")}
                </Link>
                <button
                  type="button"
                  onClick={() => setClearTarget(cart.workshopId)}
                  className="rounded-full p-1.5 text-faint hover:bg-danger/10 hover:text-danger"
                  aria-label={t("cart.clear")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y divide-line">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-3 p-4">
                    <Link href={`/shop`} className="shrink-0">
                      <ImageWithFallback
                        src={item.product.imageUrl}
                        alt={item.product.title}
                        className="h-20 w-20 rounded-input sm:h-24 sm:w-24"
                        sizes="96px"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium text-fg">{item.product.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted">{item.product.brand}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await removeItem.mutateAsync(item.id);
                              toast.success(t("toasts.removedFromCart"));
                            } catch {
                              toast.error(t("toasts.error"));
                            }
                          }}
                          className="rounded-full p-1.5 text-faint hover:bg-danger/10 hover:text-danger"
                          aria-label={t("cart.remove")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-full border border-line">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center text-muted hover:text-fg disabled:opacity-40"
                            disabled={item.qty <= 1 || updateItem.isPending}
                            onClick={() =>
                              updateItem.mutate({ itemId: item.id, qty: item.qty - 1 })
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-medium">{item.qty}</span>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center text-muted hover:text-fg disabled:opacity-40"
                            disabled={item.qty >= item.product.stock || updateItem.isPending}
                            onClick={() =>
                              updateItem.mutate({ itemId: item.id, qty: item.qty + 1 })
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="font-heading text-sm font-semibold text-fg">
                          {formatCurrency(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("checkout.summary")}</h2>
            <p className="mt-1 text-[11px] text-muted">
              {t("cart.workshopCount", { count: carts.length })} ·{" "}
              {t("cart.itemCount", { count: itemCount })}
            </p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("cart.subtotal")}</span>
                <span className="text-fg">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("common.discount")}</span>
                <span className="text-fg">{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-3 text-sm">
                <span className="font-medium text-fg">{t("cart.total")}</span>
                <span className="font-heading font-semibold text-fg">{formatCurrency(subtotal)}</span>
              </div>
            </div>
            <Button asChild size="lg" className="mt-4 w-full">
              <Link href="/checkout">
                {t("cart.checkout")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="mt-2 w-full">
              <Link href="/shop">{t("cart.continueShopping")}</Link>
            </Button>
            <div className="mt-4 flex items-start gap-2 rounded-input border border-line bg-surface2/50 p-3 text-[11px] leading-relaxed text-muted">
              <Badge variant="lime" className="shrink-0">{t("common.pickupOrDelivery")}</Badge>
              {t("cart.shippingAtCheckout")}
            </div>
          </Card>
        </aside>
      </div>

      <Dialog open={Boolean(clearTarget)} onOpenChange={(open) => !open && setClearTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{clearTarget === "all" ? t("cart.clearAll") : t("cart.clear")}</DialogTitle>
            <DialogDescription>
              {clearTarget === "all"
                ? t("cart.clearAllConfirm")
                : t("cart.clearConfirm", { workshop: targetName ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setClearTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" disabled={clearCart.isPending} onClick={clearEverything}>
              {t("cart.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
