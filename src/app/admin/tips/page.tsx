import { Lightbulb, Sparkles } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import { getAdminTips, getAdminTipStatusCounts, requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import {
  approveTipAction,
  createTipAction,
  deleteTipAction,
  generateTipProposalsAction,
  rejectTipAction,
  updateTipAction
} from "../actions";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatCard, StatusBadge, formatEnumLabel } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

const CATEGORY_OPTIONS = ["GENERAL", "BEGINNER", "HEAVY_WEIGHT", "EXPERIENCED", "MARATHON"].map((value) => ({
  value,
  label: formatEnumLabel(value)
}));

const STATUS_OPTIONS = ["PROPOSED", "PUBLISHED", "REJECTED"].map((value) => ({ value, label: formatEnumLabel(value) }));

type AdminTipsPageProps = {
  searchParams?: Promise<{ q?: string; status?: string; category?: string; page?: string }>;
};

export default async function AdminTipsPage({ searchParams }: AdminTipsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const [{ items: tips, page, totalPages }, counts] = await Promise.all([
    getAdminTips({ q: filters?.q, status: filters?.status, category: filters?.category }, pagination),
    getAdminTipStatusCounts()
  ]);

  const hasActiveFilters = Boolean(filters?.q || filters?.status || filters?.category);

  return (
    <AdminShell
      title="Coach tips"
      description="Tips shown to runners on the coach dashboard, matched to their profile. Review AI proposals, edit them, and publish."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Proposed (needs review)" value={counts.proposed} icon={Sparkles} tone="orange" />
        <StatCard label="Published" value={counts.published} icon={Lightbulb} />
        <StatCard label="Rejected" value={counts.rejected} icon={Lightbulb} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <GenerateProposalsCard />
        <CreateTipCard />
      </div>

      <FilterBar action="/admin/tips" searchPlaceholder="Search tip text (any language)" defaultSearch={filters?.q}>
        <SelectFilter name="status" label="All statuses" defaultValue={filters?.status} options={STATUS_OPTIONS} />
        <SelectFilter name="category" label="All categories" defaultValue={filters?.category} options={CATEGORY_OPTIONS} />
      </FilterBar>

      {tips.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No tips found"
          description={
            hasActiveFilters
              ? "No tips match the current filters. Try clearing them to see the full list."
              : "Generate AI proposals or add a tip manually to get started."
          }
          action={
            hasActiveFilters ? (
              <ButtonLink href="/admin/tips" size="sm" variant="outline">
                Reset filters
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {tips.map((tip) => (
              <article key={tip.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={tip.status} />
                  <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-black text-brand-teal">
                    {formatEnumLabel(tip.category)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    {tip.source === "AI" ? "AI proposal" : "Manual"}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">Added {formatDate(tip.createdAt)}</span>
                </div>

                {/* Editable in place so the admin can improve a proposal before publishing. */}
                <form action={updateTipAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="id" value={tip.id} />
                  <label className="grid gap-1 text-xs font-bold text-gray-700">
                    Category
                    <select
                      name="category"
                      defaultValue={tip.category}
                      className="h-10 w-full max-w-xs rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TipTextarea name="textEn" label="English" defaultValue={tip.textEn} />
                  <TipTextarea name="textFr" label="French" defaultValue={tip.textFr} />
                  <TipTextarea name="textAr" label="Arabic" defaultValue={tip.textAr} dir="rtl" />
                  <div>
                    <Button type="submit" size="sm" variant="outline">
                      Save edits
                    </Button>
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                  {tip.status !== "PUBLISHED" ? (
                    <form action={approveTipAction}>
                      <input type="hidden" name="id" value={tip.id} />
                      <Button type="submit" size="sm" variant="secondary">
                        Publish
                      </Button>
                    </form>
                  ) : null}
                  {tip.status !== "REJECTED" ? (
                    <form action={rejectTipAction}>
                      <input type="hidden" name="id" value={tip.id} />
                      <Button type="submit" size="sm" variant="ghost" className="text-red-700 hover:bg-red-50">
                        Reject
                      </Button>
                    </form>
                  ) : null}
                  <form action={deleteTipAction} className="ms-auto">
                    <input type="hidden" name="id" value={tip.id} />
                    <Button type="submit" size="sm" variant="ghost" className="text-gray-500 hover:bg-gray-100">
                      Delete
                    </Button>
                  </form>
                </div>
              </article>
            ))}
          </div>
          <Pagination basePath="/admin/tips" searchParams={filters} page={page} totalPages={totalPages} />
        </div>
      )}
    </AdminShell>
  );
}

function GenerateProposalsCard() {
  return (
    <form action={generateTipProposalsAction} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-brand-orange" aria-hidden="true" />
        <h2 className="text-base font-black text-gray-950">Generate AI proposals</h2>
      </div>
      <p className="text-sm text-gray-600">Draft candidate tips for a category. They land as proposals for you to review, edit, and publish.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-xs font-bold text-gray-700">
          Category
          <select
            name="category"
            defaultValue="GENERAL"
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-gray-700">
          Count
          <input
            type="number"
            name="count"
            min={1}
            max={10}
            defaultValue={5}
            className="h-10 w-24 rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
      </div>
      <div>
        <Button type="submit" size="sm">
          <Sparkles className="size-4" aria-hidden="true" /> Generate proposals
        </Button>
      </div>
    </form>
  );
}

function CreateTipCard() {
  return (
    <form action={createTipAction} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 text-brand-teal" aria-hidden="true" />
        <h2 className="text-base font-black text-gray-950">Add a tip manually</h2>
      </div>
      <label className="grid gap-1 text-xs font-bold text-gray-700">
        Category
        <select
          name="category"
          defaultValue="GENERAL"
          className="h-10 w-full max-w-xs rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <TipTextarea name="textEn" label="English" required />
      <TipTextarea name="textFr" label="French" required />
      <TipTextarea name="textAr" label="Arabic" required dir="rtl" />
      <div>
        <Button type="submit" size="sm" variant="secondary">
          Add published tip
        </Button>
      </div>
    </form>
  );
}

function TipTextarea({
  name,
  label,
  defaultValue,
  required = false,
  dir
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  dir?: "rtl";
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-gray-700">
      {label}
      <textarea
        name={name}
        rows={2}
        required={required}
        defaultValue={defaultValue}
        dir={dir}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
