"use client";

import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { useCarts, useCreateOrder } from "@/lib/api/hooks";
import type { CreateOrderInput, FulfillmentMethod, PaymentMethod } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format";
import {
  EXPEDITION_COURIERS,
  INSTANT_COURIERS,
  type CourierId,
  shippingCostFor,
  totalWeight,
} from "@/lib/shipping";
import { cn } from "@/lib/utils";

type OnlineMethod = Exclude<PaymentMethod, "cash">;
type GroupChoice = { fulfillment: FulfillmentMethod; courier: CourierId };

const DEFAULT_CHOICE: GroupChoice = { fulfillment: "pickup", courier: "jne" };

const methods: {
  value: OnlineMethod;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: "va" | "bank_transfer" | "qris";
  hintKey: "vaHint" | "bankTransferHint" | "qrisHint";
}[] = [
  { value: "va", icon: Wallet, labelKey: "va", hintKey: "vaHint" },
  { value: "bank_transfer", icon: CreditCard, labelKey: "bank_transfer", hintKey: "bankTransferHint" },
  { value: "qris", icon: QrCode, labelKey: "qris", hintKey: "qrisHint" },
];

export default function CheckoutPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const cartsQuery = useCarts(Boolean(user));
  const createOrder = useCreateOrder();
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [method, setMethod] = useState<OnlineMethod>("va");
  const [choices, setChoices] = useState<Record<string, GroupChoice>>({});
  const [recipient, setRecipient] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.phone) setPhone((current) => current || user.phone);
    if (user?.fullName) setRecipient((current) => current || user.fullName);
  }, [user?.phone, user?.fullName]);

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 font-heading text-xl font-semibold text-fg">{t("cart.loginRequired")}</h1>
        <Button asChild className="mt-4">
          <Link href="/auth/login?returnTo=/checkout">{t("common.login")}</Link>
        </Button>
      </Card>
    );
  }
  if (cartsQuery.isLoading) return <PageLoading />;

  const carts = cartsQuery.data ?? [];
  if (carts.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t("checkout.empty")}
        description={t("cart.emptyBody")}
        action={
          <Button asChild>
            <Link href="/shop">{t("cart.browseShop")}</Link>
          </Button>
        }
      />
    );
  }

  const choiceFor = (workshopId: string) => choices[workshopId] ?? DEFAULT_CHOICE;
  const updateChoice = (workshopId: string, patch: Partial<GroupChoice>) => {
    setChoices((current) => ({
      ...current,
      [workshopId]: { ...(current[workshopId] ?? DEFAULT_CHOICE), ...patch },
    }));
  };

  const groups = carts.map((cart) => {
    const choice = choiceFor(cart.workshopId);
    const weightGrams = totalWeight(
      cart.items.map((item) => ({ weightGrams: item.product.weightGrams, qty: item.qty })),
    );
    const shippingCost =
      choice.fulfillment === "expedition" ? shippingCostFor(choice.courier, weightGrams) : 0;
    return {
      cart,
      choice,
      weightGrams,
      shippingCost,
      total: cart.subtotal + shippingCost,
    };
  });

  const subtotal = groups.reduce((sum, group) => sum + group.cart.subtotal, 0);
  const shippingTotal = groups.reduce((sum, group) => sum + group.shippingCost, 0);
  const grandTotal = subtotal + shippingTotal;
  const totalItems = groups.reduce(
    (sum, group) => sum + group.cart.items.reduce((count, item) => count + item.qty, 0),
    0,
  );
  const needsAddress = groups.some((group) => group.choice.fulfillment === "expedition");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!phone.trim() || phone.trim().length < 8) {
      setError(t("validation.phone"));
      return;
    }
    if (
      needsAddress &&
      (!recipient.trim() || !addressLine.trim() || !city.trim() || !postalCode.trim())
    ) {
      setError(t("checkout.addressRequired"));
      return;
    }
    try {
      const address = {
        recipient: recipient.trim(),
        phone: phone.trim(),
        line: addressLine.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
      };
      const orderIds: string[] = [];
      for (const group of groups) {
        const input: CreateOrderInput = {
          workshopId: group.cart.workshopId,
          customerPhone: phone.trim(),
          paymentMethod: method,
          fulfillment: group.choice.fulfillment,
          shipping:
            group.choice.fulfillment === "expedition"
              ? { courier: group.choice.courier, address }
              : undefined,
        };
        const order = await createOrder.mutateAsync(input);
        orderIds.push(order.id);
      }
      toast.success(
        orderIds.length === 1
          ? t("toasts.orderPlaced")
          : t("toasts.ordersPlaced", { count: orderIds.length }),
      );
      router.push(orderIds.length === 1 ? `/orders/${orderIds[0]}` : "/orders");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("checkout.error");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Link href="/cart" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("checkout.backToCart")}
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {t("checkout.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("checkout.subtitle")}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("checkout.contact")}</h2>
            <div className="mt-4 max-w-md">
              <Field label={t("checkout.phone")} hint={t("checkout.phoneHint")} error={error ? error : undefined}>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+62 812 3456 7890"
                  inputMode="tel"
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-base font-semibold text-fg">{t("checkout.perWorkshop")}</h2>
                <p className="mt-1 text-xs text-muted">{t("checkout.perWorkshopHint")}</p>
              </div>
              <Badge variant="outline">{t("checkout.orderCount", { count: groups.length })}</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {groups.map(({ cart, choice, weightGrams, shippingCost }) => (
                <div key={cart.id} className="rounded-card border border-line bg-surface2/30 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Store className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{cart.workshopName}</p>
                      <p className="text-[10px] text-muted">
                        {t("checkout.workshopItems", {
                          count: cart.items.reduce((count, item) => count + item.qty, 0),
                        })}
                      </p>
                    </div>
                    <span className="ml-auto font-heading text-xs font-semibold text-fg">
                      {formatCurrency(cart.subtotal)}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 text-[11px]">
                        <span className="min-w-0 truncate text-muted">
                          {item.qty}× {item.product.title}
                        </span>
                        <span className="shrink-0 text-fg">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      { value: "pickup" as const, icon: Store, title: t("checkout.pickupAt"), body: t("checkout.freePickup") },
                      {
                        value: "expedition" as const,
                        icon: Truck,
                        title: t("checkout.deliverTo"),
                        body:
                          choice.fulfillment === "expedition"
                            ? formatCurrency(shippingCost)
                            : t("checkout.shippingAtCheckout"),
                      },
                    ].map((option) => {
                      const active = choice.fulfillment === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateChoice(cart.workshopId, { fulfillment: option.value })}
                          className={cn(
                            "flex items-center gap-2.5 rounded-input border p-2.5 text-left transition-colors",
                            active
                              ? "border-accent/50 bg-accent/5"
                              : "border-line bg-surface hover:border-lineStrong",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                              active ? "border-accent/30 bg-accent/10 text-accent" : "border-line text-muted",
                            )}
                          >
                            <option.icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-medium text-fg">{option.title}</span>
                            <span className="block text-[10px] text-muted">{option.body}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {choice.fulfillment === "expedition" ? (
                    <div className="mt-3 space-y-2">
                      <Field label={t("checkout.courier")}>
                        <Select
                          value={choice.courier}
                          onChange={(event) =>
                            updateChoice(cart.workshopId, { courier: event.target.value as CourierId })
                          }
                        >
                          <optgroup label={t("checkout.instantGroup")}>
                            {INSTANT_COURIERS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} {option.service} ·{" "}
                                {formatCurrency(shippingCostFor(option.id, weightGrams))}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={t("checkout.expeditionGroup")}>
                            {EXPEDITION_COURIERS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} {option.service} ·{" "}
                                {formatCurrency(shippingCostFor(option.id, weightGrams))}
                              </option>
                            ))}
                          </optgroup>
                        </Select>
                      </Field>
                      <p className="text-[10px] text-muted">
                        {t("checkout.shippingNote", {
                          weight: (weightGrams / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 }),
                          cost: formatCurrency(shippingCost),
                        })}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          {needsAddress ? (
            <Card className="p-5">
              <h2 className="font-heading text-base font-semibold text-fg">{t("checkout.deliveryAddress")}</h2>
              <p className="mt-1 text-xs text-muted">{t("checkout.deliveryAddressHint")}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={t("checkout.recipient")}>
                  <Input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
                </Field>
                <Field label={t("checkout.city")}>
                  <Input value={city} onChange={(event) => setCity(event.target.value)} />
                </Field>
              </div>
              <div className="mt-4">
                <Field label={t("checkout.addressLine")} hint={t("checkout.addressLineHint")}>
                  <Textarea
                    rows={2}
                    value={addressLine}
                    onChange={(event) => setAddressLine(event.target.value)}
                    placeholder="Jl. Contoh No. 12, RT 03/RW 05"
                  />
                </Field>
              </div>
              <div className="mt-4 max-w-40">
                <Field label={t("checkout.postalCode")}>
                  <Input
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    inputMode="numeric"
                  />
                </Field>
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="font-heading text-base font-semibold text-fg">{t("checkout.paymentMethod")}</h2>
            <div className="mt-4 grid gap-2.5">
              {methods.map((item) => {
                const active = method === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMethod(item.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-card border p-3.5 text-left transition-colors",
                      active ? "border-accent/50 bg-accent/5" : "border-line bg-surface hover:border-lineStrong",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border",
                        active ? "border-accent/30 bg-accent/10 text-accent" : "border-line text-muted",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{t(`checkout.${item.labelKey}`)}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {t(`checkout.${item.hintKey}`)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        active ? "border-accent bg-accent text-accentInk" : "border-line",
                      )}
                    >
                      {active ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div>
                <p className="font-medium text-fg">{t("checkout.terms")}</p>
                <p className="mt-1">{t("checkout.termsBody")}</p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-accent" />
              <h2 className="font-heading text-base font-semibold text-fg">{t("checkout.summary")}</h2>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {t("checkout.orderCount", { count: groups.length })} ·{" "}
              {t("cart.itemCount", { count: totalItems })}
            </p>

            <div className="mt-3 space-y-2">
              {groups.map(({ cart, shippingCost, choice }) => (
                <div key={cart.id} className="rounded-input border border-line bg-surface2/40 p-2.5">
                  <div className="flex items-start justify-between gap-3 text-[11px]">
                    <span className="min-w-0 truncate font-medium text-fg">{cart.workshopName}</span>
                    <span className="shrink-0 text-fg">{formatCurrency(cart.subtotal)}</span>
                  </div>
                  <div className="mt-1 flex items-start justify-between gap-3 text-[10px]">
                    <span className="truncate text-muted">
                      {choice.fulfillment === "expedition" ? t("checkout.shipping") : t("checkout.pickupAt")}
                    </span>
                    <span className={choice.fulfillment === "expedition" ? "text-fg" : "text-success"}>
                      {choice.fulfillment === "expedition"
                        ? formatCurrency(shippingCost)
                        : t("checkout.freePickup")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("cart.subtotal")}</span>
                <span className="text-fg">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("checkout.shipping")}</span>
                <span className="text-fg">
                  {shippingTotal > 0 ? formatCurrency(shippingTotal) : t("checkout.freePickup")}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium text-fg">{t("cart.total")}</span>
                <span className="font-heading font-semibold text-fg">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-faint">{t("checkout.separatePayments")}</p>

            <Button type="submit" size="lg" className="mt-3 w-full" disabled={createOrder.isPending}>
              {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              {createOrder.isPending
                ? t("checkout.placingOrders")
                : t("checkout.placeOrders", { count: groups.length })}
            </Button>
            {error ? <p className="mt-2 text-center text-xs text-danger">{error}</p> : null}
            <p className="mt-2 text-center text-[10px] text-faint">
              {t("checkout.paymentWindow")} · {t("checkout.minutes", { minutes: 60 })}
            </p>
          </Card>
        </aside>
      </div>
    </form>
  );
}
