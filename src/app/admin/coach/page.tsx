import { Activity, BadgeDollarSign, Bot, Coins, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/admin";
import {
  expireStaleCoachSubscriptions,
  getCoachUsageSummary,
  getCoachUserUsage,
  type CoachTierLabel
} from "@/lib/coach-admin";
import { parsePagination } from "@/lib/pagination";
import { AdminShell, EmptyState, FilterBar, StatCard } from "../_components/admin-ui";
import { activateCoachSubscriptionAction, deactivateCoachSubscriptionAction } from "./actions";

export const dynamic = "force-dynamic";

type AdminCoachPageProps = {
  searchParams?: Promise<{ q?: string; page?: string }>;
};

export default async function AdminCoachPage({ searchParams }: AdminCoachPageProps) {
  await requireAdmin();
  await expireStaleCoachSubscriptions();

  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const [summary, usage] = await Promise.all([
    getCoachUsageSummary(),
    getCoachUserUsage({ search: filters?.q }, pagination)
  ]);

  return (
    <AdminShell
      title="AI coach"
      description="Track AI coach usage and API consumption per runner, and manage paid subscriptions. Free trial: 30 days from signup (3/day, 30/month). Paid: 20/day. Prices 500 DA/month or 4000 DA/year are activated manually after payment."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Requests (30 days)" value={formatNumber(summary.requests30d)} icon={Activity} />
        <StatCard label="Requests (all time)" value={formatNumber(summary.totalRequests)} icon={Bot} />
        <StatCard label="Estimated cost" value={formatUsd(summary.costMicroUsd)} icon={Coins} tone="orange" />
        <StatCard label="Tokens in / out" value={`${formatNumber(summary.inputTokens)} / ${formatNumber(summary.outputTokens)}`} icon={Sparkles} />
        <StatCard label="Active subscribers" value={formatNumber(summary.activeSubscribers)} icon={BadgeDollarSign} tone="orange" />
        <StatCard label="Coached runners" value={formatNumber(summary.coachedUsers)} icon={Users} />
      </div>

      <FilterBar action="/admin/coach" searchPlaceholder="Search runner name or email" defaultSearch={filters?.q} />

      {usage.items.length === 0 ? (
        <EmptyState title="No coach activity yet" description="Runners who use the AI coach or have a subscription will appear here." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Runner</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Requests (30d / all)</th>
                  <th className="px-4 py-3">Tokens (in / out)</th>
                  <th className="px-4 py-3">Est. cost</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Subscription</th>
                  <th className="px-4 py-3">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usage.items.map((row) => (
                  <tr key={row.userId} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-black text-gray-950">{row.name.trim() || "—"}</p>
                      <p className="break-all text-xs text-gray-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={row.tier} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {formatNumber(row.requests30d)} / {formatNumber(row.totalRequests)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatNumber(row.inputTokens)} / {formatNumber(row.outputTokens)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{formatUsd(row.costMicroUsd)}</td>
                    <td className="px-4 py-3 text-gray-600">{row.lastActivityAt ? formatDateTime(row.lastActivityAt) : "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.subscriptionPlan ? (
                        <span className="font-semibold text-gray-800">
                          {row.subscriptionPlan}
                          <span className="block text-xs font-medium text-gray-500">
                            until {row.subscriptionExpiresAt ? formatDateTime(row.subscriptionExpiresAt) : "—"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <details className="group">
                        <summary className="cursor-pointer list-none rounded-md border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-brand-teal hover:text-brand-teal">
                          Manage
                        </summary>
                        <div className="mt-3 w-72 space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                          <form action={activateCoachSubscriptionAction} className="space-y-2">
                            <input type="hidden" name="userId" value={row.userId} />
                            <div className="grid grid-cols-2 gap-2">
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Plan
                                <select name="plan" defaultValue="MONTHLY" className={inputClass}>
                                  <option value="MONTHLY">Monthly (500 DA)</option>
                                  <option value="YEARLY">Yearly (4000 DA)</option>
                                  <option value="CUSTOM">Custom</option>
                                </select>
                              </label>
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Months
                                <input name="months" type="number" min="1" max="36" defaultValue="1" required className={inputClass} />
                              </label>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Amount (DA)
                                <input name="amountDa" type="number" min="0" placeholder="500" className={inputClass} />
                              </label>
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Note
                                <input name="note" maxLength={200} placeholder="optional" className={inputClass} />
                              </label>
                            </div>
                            <Button type="submit" size="sm" className="w-full">
                              Activate / Renew
                            </Button>
                          </form>
                          {row.subscriptionPlan ? (
                            <form action={deactivateCoachSubscriptionAction}>
                              <input type="hidden" name="userId" value={row.userId} />
                              <Button type="submit" size="sm" variant="outline" className="w-full">
                                Cancel subscription
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/admin/coach" searchParams={filters} page={usage.page} totalPages={usage.totalPages} />
        </div>
      )}
    </AdminShell>
  );
}

function TierBadge({ tier }: { tier: CoachTierLabel }) {
  const map: Record<CoachTierLabel, { label: string; variant: "green" | "blue" | "red" }> = {
    SUBSCRIBED: { label: "Subscribed", variant: "green" },
    TRIAL: { label: "Trial", variant: "blue" },
    EXPIRED: { label: "Expired", variant: "red" }
  };
  const entry = map[tier];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

const inputClass = "h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatUsd(microUsd: number) {
  return `$${(microUsd / 1_000_000).toFixed(4)}`;
}
