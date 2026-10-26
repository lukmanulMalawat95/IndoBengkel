"use client";

import { Clock3, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ServiceDialog } from "@/components/domain/workshop-dialogs";
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
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteWorkshopService,
  useUpdateWorkshopService,
  useWorkshopServices,
} from "@/lib/api/hooks";
import type { Service } from "@/lib/api/types";
import { formatCurrency, formatDuration } from "@/lib/format";

export default function WorkshopServicesPage() {
  const t = useTranslations();
  const servicesQuery = useWorkshopServices();
  const updateService = useUpdateWorkshopService();
  const deleteService = useDeleteWorkshopService();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  if (servicesQuery.isLoading) return <PageLoading />;
  if (servicesQuery.isError) return <ErrorState onRetry={() => servicesQuery.refetch()} />;

  const services = servicesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.services")}
        title={t("console.services")}
        description={t("console.servicesSubtitle")}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("console.addService")}
          </Button>
        }
      />

      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t("console.noServices")}
          description={t("console.noServicesBody")}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> {t("console.addService")}
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {services.map((service) => (
            <div key={service.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-fg">{service.name}</p>
                  <Badge variant={service.isActive ? "success" : "default"}>
                    {service.isActive ? t("console.active") : t("console.inactive")}
                  </Badge>
                  <span className="rounded-full border border-line bg-surface2 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-faint">
                    {t(`serviceCategories.${service.category}`)} · {t(`serviceKinds.${service.kind}`)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{service.description}</p>
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-faint">
                  <Clock3 className="h-3 w-3" /> {formatDuration(service.durationMinutes)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <p className="font-heading text-sm font-semibold text-fg">
                  {service.price === 0 ? t("booking.free") : formatCurrency(service.price)}
                </p>
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  <Switch
                    checked={service.isActive}
                    onCheckedChange={(checked) =>
                      updateService.mutate({ id: service.id, values: { isActive: checked } })
                    }
                  />
                </label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(service);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-danger"
                    onClick={() => setDeleting(service)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <ServiceDialog open={dialogOpen} onOpenChange={setDialogOpen} service={editing} />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.delete")}</DialogTitle>
            <DialogDescription>{t("console.deleteServiceConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={deleteService.isPending}
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteService.mutateAsync(deleting.id);
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
