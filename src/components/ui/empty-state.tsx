import type { ComponentType, ReactNode } from "react";

// Shared empty state for user-facing surfaces (account, organizer, public lists).
// Theme-aware via the literal-class remap in globals.css. Pass a lucide icon and an
// optional action (e.g. a ButtonLink) so empty states guide the next step instead of
// being a dead end. The admin area has its own EmptyState in admin/_components.
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm ${className ?? ""}`.trim()}
    >
      {Icon ? (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
          <Icon className="size-6" aria-hidden={true} />
        </div>
      ) : null}
      <h2 className="text-lg font-black text-gray-950">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
