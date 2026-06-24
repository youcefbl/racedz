import { cn } from "@/lib/utils";

// Shimmer placeholder block. Use to mirror the shape of content that's loading so the
// layout doesn't jump in when data arrives. Theme-aware via the gray remap in globals.css.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-gray-200", className)} aria-hidden="true" />;
}
