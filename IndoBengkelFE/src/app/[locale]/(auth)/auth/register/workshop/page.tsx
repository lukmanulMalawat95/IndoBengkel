"use client";

import { Loader2, MapPin, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPanel } from "@/components/domain/map-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import type { WorkshopType } from "@/lib/api/types";

const defaultCenter = { lat: -6.2088, lng: 106.8456 };

export default function RegisterWorkshopPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading, registerWorkshop } = useAuth();
  const [form, setForm] = useState({
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    workshopName: "",
    workshopType: "motor" as WorkshopType,
    addressLine: "",
    city: "",
  });
  const [coords, setCoords] = useState(defaultCenter);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(user.role === "workshop_owner" ? "/workshop" : "/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  const markers = useMemo(
    () => [{ id: "pin", lat: coords.lat, lng: coords.lng, label: form.workshopName || "New workshop", active: true }],
    [coords, form.workshopName],
  );

  if (isLoading) return <PageLoading />;

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (
      !form.ownerName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password ||
      !form.workshopName.trim() ||
      !form.addressLine.trim() ||
      !form.city.trim()
    ) {
      setError(t("validation.required"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("validation.minPassword"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("validation.passwordMismatch"));
      return;
    }
    if (!terms) {
      setError(t("validation.terms"));
      return;
    }
    setPending(true);
    try {
      await registerWorkshop({
        ownerName: form.ownerName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        workshopName: form.workshopName.trim(),
        workshopType: form.workshopType,
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        lat: coords.lat,
        lng: coords.lng,
      });
      toast.success(t("auth.workshopRegisterSuccess"));
      router.push("/auth/verify?next=/workshop/profile");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("auth.error"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-fg">
          {t("auth.workshopRegisterTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{t("auth.workshopRegisterSubtitle")}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth.fullName")}>
            <Input
              required
              value={form.ownerName}
              onChange={(event) => set("ownerName", event.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field label={t("auth.phone")} hint={t("auth.phoneHint")}>
            <Input
              required
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              placeholder="+62 812 0000 0000"
              autoComplete="tel"
            />
          </Field>
        </div>

        <Field label={t("auth.email")} hint={t("auth.emailHint")}>
          <Input
            type="email"
            required
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            autoComplete="email"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
            <Input
              type="password"
              required
              value={form.password}
              onChange={(event) => set("password", event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t("auth.confirmPassword")}>
            <Input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(event) => set("confirmPassword", event.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            <Wrench className="h-3.5 w-3.5" /> {t("auth.workshopName")}
          </p>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("auth.workshopName")}>
                <Input
                  required
                  value={form.workshopName}
                  onChange={(event) => set("workshopName", event.target.value)}
                />
              </Field>
              <Field label={t("auth.workshopType")} hint={t("auth.workshopTypeHint")}>
                <Select
                  value={form.workshopType}
                  onChange={(event) => set("workshopType", event.target.value as WorkshopType)}
                >
                  <option value="motor">{t("vehicles.motor")}</option>
                  <option value="mobil">{t("vehicles.mobil")}</option>
                </Select>
              </Field>
            </div>
            <Field label={t("auth.address")} hint={t("auth.addressHint")}>
              <Input
                required
                value={form.addressLine}
                onChange={(event) => set("addressLine", event.target.value)}
              />
            </Field>
            <Field label={t("auth.city")} hint={t("auth.cityHint")}>
              <Input
                required
                value={form.city}
                onChange={(event) => set("city", event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
            <MapPin className="h-3.5 w-3.5 text-accent" /> {t("auth.chooseLocation")}
          </p>
          <div className="h-56 overflow-hidden rounded-input border border-line">
            <MapPanel
              center={coords}
              zoom={13}
              markers={markers}
              onMapClick={(lat, lng) => setCoords({ lat, lng })}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={t("auth.lat")}>
              <Input
                type="number"
                step="0.000001"
                value={coords.lat}
                onChange={(event) => setCoords((current) => ({ ...current, lat: Number(event.target.value) }))}
              />
            </Field>
            <Field label={t("auth.lng")}>
              <Input
                type="number"
                step="0.000001"
                value={coords.lng}
                onChange={(event) => setCoords((current) => ({ ...current, lng: Number(event.target.value) }))}
              />
            </Field>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-faint">{t("auth.locationHint")}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-muted">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
          />
          {t("auth.terms")}
        </label>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          {pending ? t("auth.registering") : t("auth.register")}
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-5 text-center text-xs text-muted">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/auth/login" className="font-medium text-accent hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </Card>
  );
}
