import { Skeleton } from "@/components/ui/skeleton";

export default function RegistrationsLoading() {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-72" />
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="mt-3 h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-4 h-9 w-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
