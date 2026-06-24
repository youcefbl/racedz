import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-3 h-4 w-64" />
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-200">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="p-4">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="mt-2 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-24" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
