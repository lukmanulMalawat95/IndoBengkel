import { WorkshopShell } from "@/components/layout/workshop-shell";
import { RoleGate } from "@/features/auth/role-gate";

export default function WorkshopLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate role="workshop_owner">
      <WorkshopShell>{children}</WorkshopShell>
    </RoleGate>
  );
}
