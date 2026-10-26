import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2 sm:gap-2.5", className)}
      aria-label="IndoBengkel"
    >
      <LogoMark className="transition-transform duration-200 group-hover:-translate-y-px" />
      {!compact ? (
        <span className="hidden font-heading text-[21px] font-bold tracking-[-0.5px] text-fg sm:inline">
          Indo<span className="text-[color:var(--logo-wordmark)]">Bengkel</span>
        </span>
      ) : null}
    </Link>
  );
}
