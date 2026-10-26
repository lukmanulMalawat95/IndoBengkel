"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Store,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, logout } = useAuth();
  const t = useTranslations();
  const router = useRouter();

  if (!user) {
    return (
      <Button asChild size="sm" variant="secondary">
        <Link href="/auth/login">{t("common.login")}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex items-center gap-2 rounded-full border border-line bg-surface p-1 pr-2 text-muted transition-colors hover:border-lineStrong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
          <span className="hidden max-w-24 truncate text-xs font-medium text-fg sm:block">
            {user.fullName.split(" ")[0]}
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-card border border-line bg-surface p-1.5 shadow-float"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-fg">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-accent">
              {t(`roles.${user.role}`)}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <Item href="/profile" icon={UserRound}>
            {t("common.profile")}
          </Item>
          <Item href="/notifications" icon={MessageSquare}>
            {t("common.notifications")}
          </Item>
          <Item href="/vehicles" icon={Store}>
            {t("nav.garage")}
          </Item>
          {user.role === "workshop_owner" ? (
            <Item href="/workshop" icon={LayoutDashboard}>
              {t("nav.workshop")}
            </Item>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={() => {
              logout();
              toast.success(t("toasts.logoutSuccess"));
              router.push("/");
            }}
            className="flex cursor-pointer items-center gap-2 rounded-input px-3 py-2 text-sm text-danger outline-none transition-colors hover:bg-danger/10 focus:bg-danger/10"
          >
            <LogOut className="h-4 w-4" />
            {t("common.logout")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="flex cursor-pointer items-center gap-2 rounded-input px-3 py-2 text-sm text-muted outline-none transition-colors hover:bg-surface2 hover:text-fg focus:bg-surface2 focus:text-fg"
      >
        <Icon className="h-4 w-4" />
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}
