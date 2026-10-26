"use client";

import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCreateVehicle, useUpdateVehicle } from "@/lib/api/hooks";
import type { Vehicle, WorkshopType } from "@/lib/api/types";

type FormState = {
  type: WorkshopType;
  brand: string;
  model: string;
  year: string;
  plateNumber: string;
  color: string;
  odometerKm: string;
  photoUrl: string;
  reminderMonths: string;
  reminderKm: string;
};

const emptyForm: FormState = {
  type: "motor",
  brand: "",
  model: "",
  year: String(new Date().getFullYear()),
  plateNumber: "",
  color: "",
  odometerKm: "0",
  photoUrl: "",
  reminderMonths: "6",
  reminderKm: "5000",
};

export function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle | null;
  defaultType?: WorkshopType;
}) {
  const t = useTranslations();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (vehicle) {
      setForm({
        type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model,
        year: String(vehicle.year),
        plateNumber: vehicle.plateNumber,
        color: vehicle.color,
        odometerKm: String(vehicle.odometerKm),
        photoUrl: vehicle.photoUrl ?? "",
        reminderMonths: String(vehicle.reminderMonths),
        reminderKm: String(vehicle.reminderKm),
      });
    } else {
      setForm({ ...emptyForm, type: defaultType ?? "motor" });
    }
  }, [defaultType, open, vehicle]);

  const pending = createVehicle.isPending || updateVehicle.isPending;

  const submit = async () => {
    setError("");
    if (!form.brand.trim() || !form.model.trim() || !form.plateNumber.trim()) {
      setError(t("validation.required"));
      return;
    }
    if (!form.year || Number(form.year) < 1900 || Number(form.year) > new Date().getFullYear() + 1) {
      setError(t("validation.number"));
      return;
    }
    if (!form.odometerKm || Number(form.odometerKm) < 0) {
      setError(t("validation.number"));
      return;
    }
    const values = {
      type: form.type,
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      plateNumber: form.plateNumber.trim().toUpperCase(),
      color: form.color.trim(),
      odometerKm: Number(form.odometerKm),
      photoUrl: form.photoUrl.trim() || undefined,
      reminderMonths: Number(form.reminderMonths) || 6,
      reminderKm: Number(form.reminderKm) || 5000,
    };
    try {
      if (vehicle) {
        await updateVehicle.mutateAsync({ id: vehicle.id, values });
      } else {
        await createVehicle.mutateAsync(values);
      }
      toast.success(t("toasts.saved"));
      onOpenChange(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toasts.error");
      setError(message);
      toast.error(message);
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{vehicle ? t("vehicles.editTitle") : t("vehicles.addTitle")}</DialogTitle>
          <DialogDescription>{t("vehicles.odometerHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("vehicles.type")}>
            <Select value={form.type} onChange={(event) => set("type", event.target.value as WorkshopType)}>
              <option value="motor">{t("vehicles.motor")}</option>
              <option value="mobil">{t("vehicles.mobil")}</option>
            </Select>
          </Field>
          <Field label={t("vehicles.year")}>
            <Input
              type="number"
              value={form.year}
              onChange={(event) => set("year", event.target.value)}
              min={1900}
              max={new Date().getFullYear() + 1}
            />
          </Field>
          <Field label={t("vehicles.brand")}>
            <Input value={form.brand} onChange={(event) => set("brand", event.target.value)} placeholder="Honda" />
          </Field>
          <Field label={t("vehicles.model")}>
            <Input value={form.model} onChange={(event) => set("model", event.target.value)} placeholder="Vario 160" />
          </Field>
          <Field label={t("vehicles.plate")} hint={t("vehicles.plateHint")}>
            <Input
              value={form.plateNumber}
              onChange={(event) => set("plateNumber", event.target.value)}
              placeholder="B 1234 XYZ"
              className="uppercase"
            />
          </Field>
          <Field label={t("vehicles.color")}>
            <Input value={form.color} onChange={(event) => set("color", event.target.value)} placeholder="Hitam" />
          </Field>
          <Field label={t("vehicles.odometer")} hint={t("vehicles.odometerHint")}>
            <Input
              type="number"
              value={form.odometerKm}
              onChange={(event) => set("odometerKm", event.target.value)}
              min={0}
              disabled={Boolean(vehicle)}
            />
          </Field>
          <Field label={t("vehicles.photo")} hint={t("common.optional")}>
            <ImageUpload
              value={form.photoUrl || undefined}
              onChange={(url) => set("photoUrl", url ?? "")}
            />
          </Field>
          <Field label={t("vehicles.reminderMonths")}>
            <Input
              type="number"
              value={form.reminderMonths}
              onChange={(event) => set("reminderMonths", event.target.value)}
              min={1}
            />
          </Field>
          <Field label={t("vehicles.reminderKm")}>
            <Input
              type="number"
              value={form.reminderKm}
              onChange={(event) => set("reminderKm", event.target.value)}
              min={100}
              step={100}
            />
          </Field>
        </div>

        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("vehicles.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
