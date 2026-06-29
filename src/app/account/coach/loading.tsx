import { Skeleton } from "@/components/ui/skeleton";

// Instant skeleton while the coach dashboard fetches, so tapping the Coach tab feels snappy.
export default function CoachLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-40 w-full rounded-lg" />
    </div>
  );
}
