import { Skeleton } from "./skeleton";

/**
 * Themed skeleton shell used while a route or role gate resolves.
 * It mirrors the rhythm of the app (header, stat row, content) so the
 * screen keeps its shape instead of collapsing to a blank canvas.
 */
export function PageLoading({ label }: { label?: string }) {
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-10"
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading…"}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="w-full space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56 max-w-[70%]" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="hidden h-10 w-32 rounded-full sm:block" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-card border border-line bg-surface p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="mb-2 h-7 w-28 max-w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-card border border-line bg-surface p-4"
            >
              <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="hidden h-8 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="mb-3 h-24 w-full rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>

      <span className="sr-only">{label ?? "Loading…"}</span>
    </div>
  );
}
