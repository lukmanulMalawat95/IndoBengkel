"use client";

import { CheckCircle2, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "./logo";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("home");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface/40 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative max-w-md">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            Night Shift
          </p>
          <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-fg">
            {t("title")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">{t("subtitle")}</p>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <Feature icon={MapPin}>{t("step1Body")}</Feature>
            <Feature icon={Clock3}>{t("step2Body")}</Feature>
            <Feature icon={ShieldCheck}>{t("step3Body")}</Feature>
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-faint">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Secure session · protected checkout
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>{children}</span>
    </li>
  );
}
