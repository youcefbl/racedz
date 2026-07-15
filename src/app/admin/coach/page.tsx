import { Activity, BadgeDollarSign, Bot, BrainCircuit, Coins, Sparkles, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/admin";
import {
  expireStaleCoachSubscriptions,
  getCoachUsageSummary,
  getCoachUserUsage,
  getPendingCoachSubscriptionRequests,
  getRecentCoachErrors,
  type CoachErrorRow,
  type CoachTierLabel,
  type PendingCoachRequestRow
} from "@/lib/coach-admin";
import { parsePagination } from "@/lib/pagination";
import { AdminShell, EmptyState, FilterBar, StatCard } from "../_components/admin-ui";
import {
  activateCoachSubscriptionAction,
  approveCoachSubscriptionRequestAction,
  deactivateCoachSubscriptionAction,
  rejectCoachSubscriptionRequestAction,
  sendCoachNoteAction
} from "./actions";

export const dynamic = "force-dynamic";

type AdminCoachPageProps = {
  searchParams?: Promise<{ q?: string; page?: string }>;
};

export default async function AdminCoachPage({ searchParams }: AdminCoachPageProps) {
  await requireAdmin();
  await expireStaleCoachSubscriptions();

  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const [summary, usage, recentErrors, pendingRequests] = await Promise.all([
    getCoachUsageSummary(),
    getCoachUserUsage({ search: filters?.q }, pagination),
    getRecentCoachErrors(),
    getPendingCoachSubscriptionRequests()
  ]);

  return (
    <AdminShell
      title="AI coach"
      description="Track coach usage and manage subscriptions."
    >
      <details className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-black text-gray-800">
          <BadgeDollarSign className="size-4 text-brand-orange" aria-hidden={true} />
          Pricing &amp; limits
        </summary>
        <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-600">
          <ul className="space-y-1.5">
            <li>
              <span className="font-bold text-gray-800">Free trial:</span> 30 days from signup — 3 requests/day, 30/month.
            </li>
            <li>
              <span className="font-bold text-gray-800">Paid:</span> 20 requests/day.
            </li>
            <li>
              <span className="font-bold text-gray-800">Pricing:</span> 500 DA/month or 4000 DA/year, activated manually after payment.
            </li>
          </ul>
        </div>
      </details>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Requests (30 days)" value={formatNumber(summary.requests30d)} icon={Activity} />
        <StatCard label="Requests (all time)" value={formatNumber(summary.totalRequests)} icon={Bot} />
        <StatCard label="Estimated cost" value={formatUsd(summary.costMicroUsd)} icon={Coins} tone="orange" />
        <StatCard label="Tokens in / out" value={`${formatNumber(summary.inputTokens)} / ${formatNumber(summary.outputTokens)}`} icon={Sparkles} />
        <StatCard label="Active subscribers" value={formatNumber(summary.activeSubscribers)} icon={BadgeDollarSign} tone="orange" />
        <StatCard label="Coached runners" value={formatNumber(summary.coachedUsers)} icon={Users} />
        <StatCard
          label="Failed AI requests (30d / all)"
          value={`${formatNumber(summary.failedRequests30d)} / ${formatNumber(summary.failedRequests)}`}
          icon={TriangleAlert}
          tone="orange"
        />
      </div>

      <RecentErrors errors={recentErrors} />

      <PendingRequests requests={pendingRequests} />

      <FilterBar action="/admin/coach" searchPlaceholder="Search runner name or email" defaultSearch={filters?.q} />

      {usage.items.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title={filters?.q ? "No runner found" : "No coach activity yet"}
          description={
            filters?.q
              ? "No user matches that name or email. Check the spelling and try again."
              : "Runners with coach activity or a subscription appear here. To activate a new runner who hasn't used the coach yet, search their name or email above."
          }
        />
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
                    <td className="px-4 py-3 font-semibold tabular-nums text-gray-700">
                      {formatNumber(row.requests30d)} / {formatNumber(row.totalRequests)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">
                      {formatNumber(row.inputTokens)} / {formatNumber(row.outputTokens)}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-gray-700">{formatUsd(row.costMicroUsd)}</td>
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
                        <summary className="inline-flex cursor-pointer list-none items-center rounded-md border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:border-brand-teal hover:text-brand-teal pointer-coarse:py-2.5">
                          Manage
                        </summary>
                        <div className="mt-3 w-72 space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                          <form action={activateCoachSubscriptionAction} className="space-y-2">
                            <input type="hidden" name="userId" value={row.userId} />
                            <div className="grid grid-cols-2 gap-2">
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Plan
                                <select name="plan" defaultValue="MONTHLY" className={inputClass}>
                                  <option value="MONTHLY">Monthly (790 DA)</option>
                                  <option value="YEARLY">Yearly (4,900 DA)</option>
                                  <option value="CUSTOM">Custom</option>
                                </select>
                              </label>
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Months (Custom only)
                                <input name="months" type="number" min="1" max="36" defaultValue="1" className={inputClass} />
                              </label>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Amount (DA) — blank = plan price
                                <input name="amountDa" type="number" min="0" placeholder="auto" className={inputClass} />
                              </label>
                              <label className="grid gap-1 text-xs font-bold text-gray-600">
                                Note
                                <input name="note" maxLength={200} placeholder="optional" className={inputClass} />
                              </label>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                              <input type="checkbox" name="student" className="size-4 accent-brand-teal" />
                              Student −20% (DZstudent)
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                              <input type="checkbox" name="humanCoaching" className="size-4 accent-brand-teal" />
                              Include human coaching
                            </label>
                            <Button type="submit" size="sm" className="w-full">
                              Activate / Renew
                            </Button>
                          </form>
                          {row.subscriptionPlan ? (
                            <>
                              <form action={sendCoachNoteAction} className="space-y-2 border-t border-gray-200 pt-3">
                                <input type="hidden" name="userId" value={row.userId} />
                                <label className="grid gap-1 text-xs font-bold text-gray-600">
                                  Send coaching note
                                  <textarea name="message" rows={3} maxLength={2000} placeholder="Personal note to this runner…" className={`${inputClass} h-auto py-2`} />
                                </label>
                                <Button type="submit" size="sm" variant="secondary" className="w-full">
                                  Send note
                                </Button>
                              </form>
                              <form action={deactivateCoachSubscriptionAction}>
                                <input type="hidden" name="userId" value={row.userId} />
                                <Button type="submit" size="sm" variant="outline" className="w-full">
                                  Cancel subscription
                                </Button>
                              </form>
                            </>
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

function RecentErrors({ errors }: { errors: CoachErrorRow[] }) {
  if (errors.length === 0) return null;

  return (
    <details className="mb-6 overflow-hidden rounded-lg border border-orange-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-orange-100 bg-orange-50 px-5 py-3 text-sm font-black text-brand-orangeText">
        <TriangleAlert className="size-4" aria-hidden={true} />
        Recent failed AI requests ({errors.length})
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Runner</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {errors.map((error) => (
              <tr key={error.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(error.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-bold text-gray-900">{error.name.trim() || "—"}</p>
                  <p className="break-all text-xs text-gray-500">{error.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={error.kind === "Audio" ? "blue" : "red"}>
                    {error.kind}
                    {error.interactionType ? ` · ${error.interactionType}` : ""}
                  </Badge>
                  <p className="mt-1 text-xs text-gray-400">{error.model}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{error.errorCode ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{error.errorMessage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function PendingRequests({ requests }: { requests: PendingCoachRequestRow[] }) {
  if (requests.length === 0) return null;

  return (
    <details open className="mb-6 overflow-hidden rounded-lg border border-brand-teal/40 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-teal-100 bg-teal-50 px-5 py-3 text-sm font-black text-brand-teal">
        <BadgeDollarSign className="size-4" aria-hidden={true} />
        Pending subscription requests ({requests.length})
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Runner</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Proof</th>
              <th className="px-4 py-3">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((request) => (
              <tr key={request.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(request.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-black text-gray-950">{request.name.trim() || "—"}</p>
                  <p className="break-all text-xs text-gray-500">{request.email}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800">{request.plan}</td>
                <td className="px-4 py-3 font-semibold tabular-nums text-gray-700">
                  {request.amountDa != null ? `${formatNumber(request.amountDa)} DA` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{request.paymentMethod ?? "—"}</td>
                <td className="px-4 py-3">
                  <a
                    href={request.paymentProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:border-brand-teal hover:text-brand-teal"
                  >
                    View proof
                  </a>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={approveCoachSubscriptionRequestAction}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </form>
                    <form action={rejectCoachSubscriptionRequestAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input name="reason" maxLength={200} placeholder="Reason (optional)" className={inputClass} />
                      <Button type="submit" size="sm" variant="outline">
                        Reject
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
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
