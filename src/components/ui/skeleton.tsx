import { cn } from "@/lib/utils";

// Shimmer placeholder block. Use to mirror the shape of content that's loading so the
// layout doesn't jump in when data arrives. Uses the surface-muted token directly so it
// stays dim in dark/race themes (base .bg-gray-200 is NOT in the theme remap).
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--surface-muted)]", className)} aria-hidden="true" />;
}
