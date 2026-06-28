import { cn } from "@/lib/utils";
import { ZIDRUN_MARK_SVG } from "@/components/layout/zidrun-logo-svg";

// Faint, oversized ZidRun blade mark for the dark teal hero / velocity panels.
// Replaces the retired drifting-chevron motif (which echoed the OLD chevron logo)
// with the current Z-blade brand mark. Purely decorative — aria-hidden. Position
// and size come from `className` (the parent must be relative + overflow-hidden so
// the mark bleeds cleanly off the corner).
export function PanelBrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rz-panel-mark pointer-events-none absolute select-none", className)}
      dangerouslySetInnerHTML={{ __html: ZIDRUN_MARK_SVG }}
    />
  );
}
