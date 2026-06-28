import type { ComponentType, ReactNode } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

// The admin chrome already establishes "you are in admin", so we don't repeat a
// redundant uppercase "ADMIN" kicker above every page title. Title + description
// carry the context; the heading is the page's anchor.
export function AdminShell({ title, description, action, children }: AdminShellProps) {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-black text-gray-950">{title}</h1>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{description}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon = ShieldCheck,
  tone = "teal"
}: {
  label: string;
  value: number | string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "teal" | "orange";
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div
        className={cn(
          "mb-4 flex size-10 items-center justify-center rounded-lg",
          tone === "orange" ? "bg-orange-50 text-brand-orange" : "bg-teal-50 text-brand-teal"
        )}
      >
        <Icon className="size-5" aria-hidden={true} />
      </div>
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-gray-950">{value}</p>
    </div>
  );
}

export function FilterBar({
  action,
  children,
  searchPlaceholder = "Search",
  defaultSearch
}: {
  action: string;
  children?: ReactNode;
  searchPlaceholder?: string;
  defaultSearch?: string;
}) {
  return (
    <form action={action} className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_auto]">
      <label className="relative">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          name="q"
          defaultValue={defaultSearch ?? ""}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {children}
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
        <ButtonLink href={action} size="sm" variant="outline">
          Reset
        </ButtonLink>
      </div>
    </form>
  );
}

export function SelectFilter({
  name,
  label,
  defaultValue,
  options
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <Badge variant={getStatusVariant(value)}>{formatEnumLabel(value)}</Badge>;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action
}: {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
      {Icon ? (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
          <Icon className="size-6" aria-hidden={true} />
        </div>
      ) : null}
      <h2 className="text-xl font-black text-gray-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusVariant(value: string) {
  if (value === "APPROVED" || value === "PUBLISHED" || value === "CONFIRMED" || value === "PAID" || value === "NOT_REQUIRED") {
    return "green";
  }

  if (value === "PENDING" || value === "PENDING_REVIEW" || value === "MANUAL_REVIEW") {
    return "orange";
  }

  if (value === "REJECTED" || value === "CANCELLED" || value === "FAILED") {
    return "red";
  }

  return "blue";
}
