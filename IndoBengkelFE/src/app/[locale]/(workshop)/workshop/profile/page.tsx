"use client";

import { CheckCircle2, Clock3, Loader2, MapPin, Save, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPanel } from "@/components/domain/map-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/label";
import { ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateWorkshop, useWorkshopMe } from "@/lib/api/hooks";
import type { WorkshopHours, WorkshopType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  workshopType: WorkshopType;
  description: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
  coverUrl: string;
  gallery: string[];
  slotCapacityPerHour: number;
  hours: WorkshopHours[];
};

export default function WorkshopProfilePage() {
  const t = useTranslations();
  const workshopQuery = useWorkshopMe();
  const updateWorkshop = useUpdateWorkshop();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");

  const workshop = workshopQuery.data;

  useEffect(() => {
    if (!workshop) return;
    setForm({
      name: workshop.name,
      workshopType: workshop.workshopType,
      description: workshop.description,
      phone: workshop.phone,
      email: workshop.email,
      addressLine: workshop.addressLine,
      city: workshop.city,
      province: workshop.province,
      postalCode: workshop.postalCode,
      lat: workshop.lat,
      lng: workshop.lng,
      coverUrl: workshop.coverUrl,
      gallery: workshop.gallery,
      slotCapacityPerHour: workshop.slotCapacityPerHour,
      hours: workshop.hours,
    });
  }, [workshop]);

  const markers = useMemo(
    () =>
      form
        ? [{ id: workshop?.id ?? "workshop", lat: form.lat, lng: form.lng, label: form.name, active: true }]
        : [],
    [form, workshop?.id],
  );

  if (workshopQuery.isLoading || !form) return <PageLoading />;
  if (workshopQuery.isError || !workshop) {
    return <ErrorState onRetry={() => workshopQuery.refetch()} />;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const setHour = (index: number, patch: Partial<WorkshopHours>) =>
    setForm((current) => {
      if (!current) return current;
      const hours = current.hours.map((hour, itemIndex) =>
        itemIndex === index ? { ...hour, ...patch } : hour,
      );
      return { ...current, hours };
    });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setError("");
    if (!form.name.trim() || !form.addressLine.trim() || !form.city.trim()) {
      setError(t("validation.required"));
      return;
    }
    try {
      await updateWorkshop.mutateAsync({
        name: form.name.trim(),
        workshopType: form.workshopType,
        description: form.description.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        postalCode: form.postalCode.trim(),
        lat: form.lat,
        lng: form.lng,
        coverUrl: form.coverUrl.trim(),
        gallery: form.gallery,
        slotCapacityPerHour: Number(form.slotCapacityPerHour) || 1,
        hours: form.hours,
      });
      toast.success(t("console.saved"));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toasts.error");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <PageHeader
        eyebrow={t("nav.profile")}
        title={t("console.profile")}
        description={t("console.profileSubtitle")}
        actions={
          <>
            <Badge variant={workshop.status === "active" ? "success" : workshop.status === "suspended" ? "danger" : "default"}>
              {t(`status.workshop.${workshop.status}`)}
            </Badge>
            <Button type="submit" size="sm" disabled={updateWorkshop.isPending}>
              {updateWorkshop.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("console.saveProfile")}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("console.profile")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t("console.workshopName")}>
                  <Input value={form.name} onChange={(event) => set("name", event.target.value)} />
                </Field>
              </div>
              <Field label={t("console.workshopType")}>
                <Select
                  value={form.workshopType}
                  onChange={(event) => set("workshopType", event.target.value as WorkshopType)}
                >
                  <option value="motor">{t("vehicles.motor")}</option>
                  <option value="mobil">{t("vehicles.mobil")}</option>
                </Select>
              </Field>
              <Field label={t("console.capacity")} hint={t("console.capacityHint")}>
                <Input
                  type="number"
                  min={1}
                  value={form.slotCapacityPerHour}
                  onChange={(event) => set("slotCapacityPerHour", Number(event.target.value))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("console.description")}>
                  <Textarea
                    value={form.description}
                    onChange={(event) => set("description", event.target.value)}
                    rows={4}
                  />
                </Field>
              </div>
              <Field label={t("console.phone")}>
                <Input value={form.phone} onChange={(event) => set("phone", event.target.value)} />
              </Field>
              <Field label={t("console.email")}>
                <Input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("console.address")}>
                  <Input value={form.addressLine} onChange={(event) => set("addressLine", event.target.value)} />
                </Field>
              </div>
              <Field label={t("console.city")}>
                <Input value={form.city} onChange={(event) => set("city", event.target.value)} />
              </Field>
              <Field label={t("console.province")}>
                <Input value={form.province} onChange={(event) => set("province", event.target.value)} />
              </Field>
              <Field label={t("console.postalCode")}>
                <Input value={form.postalCode} onChange={(event) => set("postalCode", event.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("console.coverUrl")}>
                  <ImageUpload
                    variant="banner"
                    value={form.coverUrl || undefined}
                    onChange={(url) => set("coverUrl", url ?? "")}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("console.gallery")} hint={t("console.galleryHint")}>
                  <MultiImageUpload values={form.gallery} onChange={(gallery) => set("gallery", gallery)} max={6} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-accent" /> {t("console.openingHours")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.hours.map((hour, index) => (
                <div
                  key={hour.dayOfWeek}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-input border border-line bg-surface2/40 p-3",
                    hour.isClosed ? "opacity-70" : "",
                  )}
                >
                  <span className="w-24 text-xs font-medium text-fg">
                    {new Date(2024, 0, 7 + hour.dayOfWeek).toLocaleDateString("en-GB", { weekday: "long" })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hour.openTime}
                      disabled={hour.isClosed}
                      onChange={(event) => setHour(index, { openTime: event.target.value })}
                      className="h-9 w-28"
                    />
                    <span className="text-faint">–</span>
                    <Input
                      type="time"
                      value={hour.closeTime}
                      disabled={hour.isClosed}
                      onChange={(event) => setHour(index, { closeTime: event.target.value })}
                      className="h-9 w-28"
                    />
                  </div>
                  <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-muted">
                    <Switch
                      checked={hour.isClosed}
                      onCheckedChange={(checked) => setHour(index, { isClosed: checked })}
                    />
                    {t("console.closed")}
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" /> {t("console.latitude")} / {t("console.longitude")}
              </CardTitle>
            </CardHeader>
            <div className="h-64">
              <MapPanel
                center={{ lat: form.lat, lng: form.lng }}
                zoom={15}
                markers={markers.map((marker) => ({ ...marker }))}
                onMapClick={(lat, lng) =>
                  setForm((current) => (current ? { ...current, lat, lng } : current))
                }
              />
            </div>
            <CardContent className="grid grid-cols-2 gap-3 pt-4">
              <Field label={t("console.latitude")}>
                <Input
                  type="number"
                  step="0.000001"
                  value={form.lat}
                  onChange={(event) => set("lat", Number(event.target.value))}
                />
              </Field>
              <Field label={t("console.longitude")}>
                <Input
                  type="number"
                  step="0.000001"
                  value={form.lng}
                  onChange={(event) => set("lng", Number(event.target.value))}
                />
              </Field>
              <p className="col-span-2 text-[11px] leading-relaxed text-muted">{t("auth.locationHint")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("console.profileChecklist")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { label: t("console.workshopName"), done: Boolean(form.name) },
                { label: t("console.description"), done: form.description.length > 20 },
                { label: t("console.coverUrl"), done: Boolean(form.coverUrl) },
                { label: t("console.address"), done: Boolean(form.addressLine && form.city) },
                { label: t("console.phone"), done: Boolean(form.phone) },
                { label: t("console.openingHours"), done: form.hours.length > 0 },
                { label: t("console.capacity"), done: form.slotCapacityPerHour > 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <CheckCircle2
                    className={cn("h-3.5 w-3.5", item.done ? "text-success" : "text-faint")}
                  />
                  <span className={item.done ? "text-fg" : "text-muted"}>{item.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-xs text-muted">
              <Store className="h-4 w-4 text-accent" /> {workshop.slug}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">{t("console.draftBody")}</p>
          </Card>
        </aside>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={updateWorkshop.isPending}>
          {updateWorkshop.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("console.saveProfile")}
        </Button>
      </div>
    </form>
  );
}
