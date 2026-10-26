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
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateMechanic,
  useCreateWorkshopProduct,
  useCreateWorkshopService,
  useUpdateMechanic,
  useUpdateWorkshopProduct,
  useUpdateWorkshopService,
} from "@/lib/api/hooks";
import type {
  Mechanic,
  Product,
  ProductCategory,
  Service,
  ServiceCategory,
  ServiceKind,
} from "@/lib/api/types";

/* ------------------------------- Mechanics ------------------------------- */

type MechanicForm = {
  name: string;
  phone: string;
  experienceYears: string;
  skills: string;
  photoUrl: string;
  isActive: boolean;
};

export function MechanicDialog({
  open,
  onOpenChange,
  mechanic,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mechanic?: Mechanic | null;
}) {
  const t = useTranslations();
  const create = useCreateMechanic();
  const update = useUpdateMechanic();
  const [form, setForm] = useState<MechanicForm>({
    name: "",
    phone: "",
    experienceYears: "1",
    skills: "",
    photoUrl: "",
    isActive: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (mechanic) {
      setForm({
        name: mechanic.name,
        phone: mechanic.phone,
        experienceYears: String(mechanic.experienceYears),
        skills: mechanic.skills.join(", "),
        photoUrl: mechanic.photoUrl ?? "",
        isActive: mechanic.isActive,
      });
    } else {
      setForm({ name: "", phone: "", experienceYears: "1", skills: "", photoUrl: "", isActive: true });
    }
  }, [mechanic, open]);

  const pending = create.isPending || update.isPending;

  const submit = async () => {
    setError("");
    if (!form.name.trim()) {
      setError(t("validation.required"));
      return;
    }
    const values = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      experienceYears: Number(form.experienceYears) || 0,
      skills: form.skills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      photoUrl: form.photoUrl.trim() || undefined,
      isActive: form.isActive,
    };
    try {
      if (mechanic) await update.mutateAsync({ id: mechanic.id, values });
      else await create.mutateAsync(values);
      toast.success(t("toasts.saved"));
      onOpenChange(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toasts.error");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mechanic ? t("console.editMechanic") : t("console.addMechanic")}</DialogTitle>
          <DialogDescription>{t("console.mechanicsSubtitle")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("console.name")}>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
          </div>
          <Field label={t("console.phone")}>
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label={t("console.experience")}>
            <Input
              type="number"
              min={0}
              value={form.experienceYears}
              onChange={(event) => setForm({ ...form, experienceYears: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("console.skills")} hint={t("console.skillsHint")}>
              <Input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("console.photoUrl")} hint={t("common.optional")}>
              <ImageUpload
                variant="avatar"
                value={form.photoUrl || undefined}
                onChange={(url) => setForm((current) => ({ ...current, photoUrl: url ?? "" }))}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
            <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            {t("console.active")}
          </label>
        </div>
        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Services ------------------------------- */

type ServiceForm = {
  name: string;
  description: string;
  price: string;
  durationMinutes: string;
  category: ServiceCategory;
  kind: ServiceKind;
  isActive: boolean;
};

const SERVICE_CATEGORIES: ServiceCategory[] = [
  "inspection",
  "oil",
  "engine",
  "brakes",
  "electrical",
  "tires",
  "body",
  "other",
];

export function ServiceDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
}) {
  const t = useTranslations();
  const create = useCreateWorkshopService();
  const update = useUpdateWorkshopService();
  const [form, setForm] = useState<ServiceForm>({
    name: "",
    description: "",
    price: "",
    durationMinutes: "60",
    category: "other",
    kind: "labor",
    isActive: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (service) {
      setForm({
        name: service.name,
        description: service.description,
        price: String(service.price),
        durationMinutes: String(service.durationMinutes),
        category: service.category,
        kind: service.kind,
        isActive: service.isActive,
      });
    } else {
      setForm({
        name: "",
        description: "",
        price: "",
        durationMinutes: "60",
        category: "other",
        kind: "labor",
        isActive: true,
      });
    }
  }, [open, service]);

  const pending = create.isPending || update.isPending;

  const submit = async () => {
    setError("");
    if (!form.name.trim() || !form.description.trim() || !form.price || !form.durationMinutes) {
      setError(t("validation.required"));
      return;
    }
    const values = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      durationMinutes: Number(form.durationMinutes),
      category: form.category,
      kind: form.kind,
      isActive: form.isActive,
    };
    try {
      if (service) await update.mutateAsync({ id: service.id, values });
      else await create.mutateAsync(values);
      toast.success(t("toasts.saved"));
      onOpenChange(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toasts.error");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? t("console.editService") : t("console.addService")}</DialogTitle>
          <DialogDescription>{t("console.servicesSubtitle")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("console.serviceName")}>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label={t("console.description")}>
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("console.price")} hint={t("console.priceHintFree")}>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </Field>
            <Field label={t("console.duration")}>
              <Input
                type="number"
                min={15}
                step={15}
                value={form.durationMinutes}
                onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("console.category")}>
              <Select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value as ServiceCategory })}
              >
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`serviceCategories.${category}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("console.serviceType")}>
              <Select
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as ServiceKind })}
              >
                <option value="labor">{t("serviceKinds.labor")}</option>
                <option value="part">{t("serviceKinds.part")}</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            {t("console.active")}
          </label>
        </div>
        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Products ------------------------------- */

const categories: ProductCategory[] = ["sparepart", "oil", "accessories", "tools", "other"];

type ProductForm = {
  title: string;
  description: string;
  category: ProductCategory;
  brand: string;
  partNumber: string;
  price: string;
  discountType: "none" | "percent" | "fixed";
  discountValue: string;
  weightGrams: string;
  stock: string;
  imageUrl: string;
  isActive: boolean;
};

const emptyProduct: ProductForm = {
  title: "",
  description: "",
  category: "sparepart",
  brand: "",
  partNumber: "",
  price: "",
  discountType: "none",
  discountValue: "0",
  weightGrams: "500",
  stock: "1",
  imageUrl: "",
  isActive: true,
};

export function ProductDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}) {
  const t = useTranslations();
  const create = useCreateWorkshopProduct();
  const update = useUpdateWorkshopProduct();
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (product) {
      setForm({
        title: product.title,
        description: product.description,
        category: product.category,
        brand: product.brand,
        partNumber: product.partNumber,
        price: String(product.price),
        discountType: product.discountType,
        discountValue: String(product.discountValue),
        weightGrams: String(product.weightGrams),
        stock: String(product.stock),
        imageUrl: product.imageUrl,
        isActive: product.isActive,
      });
    } else {
      setForm(emptyProduct);
    }
  }, [open, product]);

  const pending = create.isPending || update.isPending;

  const submit = async () => {
    setError("");
    if (!form.title.trim() || !form.price || !form.stock) {
      setError(t("validation.required"));
      return;
    }
    const values: Partial<Product> = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      brand: form.brand.trim(),
      partNumber: form.partNumber.trim(),
      price: Number(form.price),
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      weightGrams: Number(form.weightGrams) || 0,
      stock: Number(form.stock),
      imageUrl: form.imageUrl.trim(),
      isActive: form.isActive,
    };
    try {
      if (product) await update.mutateAsync({ id: product.id, values });
      else await create.mutateAsync(values);
      toast.success(t("toasts.saved"));
      onOpenChange(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("toasts.error");
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? t("console.editProduct") : t("console.addProduct")}</DialogTitle>
          <DialogDescription>{t("console.productsSubtitle")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("console.title")}>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("console.description")}>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
              />
            </Field>
          </div>
          <Field label={t("console.category")}>
            <Select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as ProductCategory })}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(`shop.categoryLabels.${category}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("console.brand")}>
            <Input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
          </Field>
          <Field label={t("console.partNumber")}>
            <Input
              value={form.partNumber}
              onChange={(event) => setForm({ ...form, partNumber: event.target.value })}
            />
          </Field>
          <Field label={t("console.weight")}>
            <Input
              type="number"
              min={0}
              value={form.weightGrams}
              onChange={(event) => setForm({ ...form, weightGrams: event.target.value })}
            />
          </Field>
          <Field label={t("console.price")} hint="IDR">
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
          </Field>
          <Field label={t("console.stock")}>
            <Input
              type="number"
              min={0}
              value={form.stock}
              onChange={(event) => setForm({ ...form, stock: event.target.value })}
            />
          </Field>
          <Field label={t("console.discountType")}>
            <Select
              value={form.discountType}
              onChange={(event) =>
                setForm({ ...form, discountType: event.target.value as ProductForm["discountType"] })
              }
            >
              <option value="none">{t("console.noDiscount")}</option>
              <option value="percent">{t("console.percent")}</option>
              <option value="fixed">{t("console.fixed")}</option>
            </Select>
          </Field>
          <Field label={t("console.discountValue")}>
            <Input
              type="number"
              min={0}
              disabled={form.discountType === "none"}
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("console.imageUrl")} hint={t("common.optional")}>
              <ImageUpload
                value={form.imageUrl || undefined}
                onChange={(url) => setForm((current) => ({ ...current, imageUrl: url ?? "" }))}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2">
            <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            {t("console.active")}
          </label>
        </div>
        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
