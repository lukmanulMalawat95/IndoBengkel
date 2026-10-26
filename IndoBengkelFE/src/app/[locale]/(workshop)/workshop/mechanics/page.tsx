"use client";

import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { MechanicDialog } from "@/components/domain/workshop-dialogs";
import { Avatar } from "@/components/ui/avatar";
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
  useDeleteMechanic,
  useMechanics,
  useUpdateMechanic,
} from "@/lib/api/hooks";
import type { Mechanic } from "@/lib/api/types";

export default function WorkshopMechanicsPage() {
  const t = useTranslations();
  const mechanicsQuery = useMechanics();
  const updateMechanic = useUpdateMechanic();
  const deleteMechanic = useDeleteMechanic();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [deleting, setDeleting] = useState<Mechanic | null>(null);

  if (mechanicsQuery.isLoading) return <PageLoading />;
  if (mechanicsQuery.isError) return <ErrorState onRetry={() => mechanicsQuery.refetch()} />;

  const mechanics = mechanicsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("nav.mechanics")}
        title={t("console.mechanics")}
        description={t("console.mechanicsSubtitle")}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("console.addMechanic")}
          </Button>
        }
      />

      {mechanics.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("console.noMechanics")}
          description={t("console.noMechanicsBody")}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> {t("console.addMechanic")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mechanics.map((mechanic) => (
            <Card key={mechanic.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={mechanic.name} src={mechanic.photoUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-fg">{mechanic.name}</p>
                    <Badge variant={mechanic.isActive ? "success" : "default"}>
                      {mechanic.isActive ? t("console.active") : t("console.inactive")}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {mechanic.experienceYears} {t("common.years")} · {mechanic.phone || "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mechanic.skills.length === 0 ? (
                      <span className="text-[10px] text-faint">—</span>
                    ) : (
                      mechanic.skills.map((skill) => (
                        <Badge key={skill} variant="outline">
                          {skill}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  <Switch
                    checked={mechanic.isActive}
                    onCheckedChange={(checked) =>
                      updateMechanic.mutate({ id: mechanic.id, values: { isActive: checked } })
                    }
                  />
                  {t("console.active")}
                </label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(mechanic);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-danger"
                    onClick={() => setDeleting(mechanic)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MechanicDialog open={dialogOpen} onOpenChange={setDialogOpen} mechanic={editing} />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.delete")}</DialogTitle>
            <DialogDescription>{t("console.deleteMechanicConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={deleteMechanic.isPending}
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteMechanic.mutateAsync(deleting.id);
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
