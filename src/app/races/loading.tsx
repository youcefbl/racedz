import { Skeleton } from "@/components/ui/skeleton";

// Shown while the races server component fetches. Mirrors the card grid so the layout holds.
export default function RacesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-12 w-full max-w-2xl" />
      <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
