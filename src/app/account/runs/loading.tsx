import { Skeleton } from "@/components/ui/skeleton";

// /account/runs is the app's heaviest screen — it renders up to 50 run cards. Without a
// loading state a slow connection shows a frozen page with no feedback for the whole fetch.
export default function RunsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-4 h-24 w-full rounded-xl" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <Skeleton className="size-14 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
