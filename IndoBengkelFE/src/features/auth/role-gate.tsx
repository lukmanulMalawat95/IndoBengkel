"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { UserRole } from "@/lib/api/types";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuth } from "./auth-provider";

export function RoleGate({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = user?.role === role;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user.role !== role) {
      const home = user.role === "workshop_owner" ? "/workshop" : "/";
      router.replace(home);
    }
  }, [isLoading, pathname, role, router, user]);

  if (isLoading) return <PageLoading />;
  if (!allowed) return <PageLoading />;
  return <>{children}</>;
}
