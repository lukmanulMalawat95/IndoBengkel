"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nextLocale = locale === "en" ? "id" : "en";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=31536000;samesite=lax`;
        startTransition(() => {
          router.replace(pathname, { locale: nextLocale });
        });
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted transition-colors hover:border-lineStrong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      aria-label={nextLocale === "en" ? "Switch to English" : "Ganti ke Bahasa Indonesia"}
    >
      <Languages className="h-3.5 w-3.5" />
      {locale === "en" ? "EN" : "ID"}
    </button>
  );
}
