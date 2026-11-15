import { Activity, AlertOctagon, Route as RouteIcon, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import {
  DIAGNOSTIC_PERIODS,
  getAdminDiagnosticGroups,
  getAdminDistanceCorrections,
  getAdminRunSessions,
  getRunDiagnosticsStats,
  parsePeriod,
  type AdminDiagnosticGroup,
  type AdminRunSessionRow,
} from "@/lib/runs/admin-diagnostics";
import { AdminShell, EmptyState, SelectFilter, StatCard } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ q?: string; days?: string; kind?: string }>;
};

const BASE = "/admin/run-diagnostics";

export default async function RunDiagnosticsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const days = parsePeriod(params.days);
  const filters = { q: params.q, days, kind: params.kind };

  const [stats, sessions, groups, distance] = await Promise.all([
    getRunDiagnosticsStats(days),
    getAdminRunSessions(filters),
    getAdminDiagnosticGroups(filters),
    getAdminDistanceCorrections(),
  ]);

  return (
    <AdminShell
      title="Run diagnostics"
      description={'Recordings the app started, crashes and OS kills it reported, and distances the server corrected from the route. For "my run disappeared" or "the distance is wrong", search the runner first.'}
      action={
        <nav aria-label="Sections" className="flex flex-wrap gap-2">
          <ButtonLink href="#sessions" size="sm" variant="secondary">
            Run sessions
          </ButtonLink>
          <ButtonLink href="#reports" size="sm" variant="outline">
            Crash &amp; issue reports
          </ButtonLink>
          <ButtonLink href="#distance" size="sm" variant="outline">
            Distance corrections
          </ButtonLink>
        </nav>
      }
    >
      <section aria-label="Summary" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Recordings · ${days} days`}
          value={stats.recordings}
          icon={Activity}
          hint={`${stats.saved} saved · ${stats.discarded} discarded · ${stats.open} open`}
        />
        <StatCard label="Lost runs · 30 days" value={stats.lost30d} icon={RouteIcon} tone="orange" hint="Started, never saved or discarded" />
        <StatCard
          label={`Crashes & kills · ${days} days`}
          value={stats.crashes}
          icon={AlertOctagon}
          tone="orange"
          hint={`${stats.crashProblems} distinct problems · ${stats.crashDevices} ${stats.crashDevices === 1 ? "device" : "devices"}`}
        />
        <StatCard
          label="Distances corrected"
          value={stats.applied}
          icon={Ruler}
          hint={`${stats.flagged} flagged for review · algorithm v${stats.algoVersion}`}
        />
      </section>

      <form action={BASE} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-semibold text-gray-600">
          Runner email, device model or run id
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="e.g. PLG110 or runner@…"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal text-gray-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
          Period
          <select
            name="days"
            defaultValue={String(days)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            {DIAGNOSTIC_PERIODS.map((period) => (
              <option key={period} value={period}>
                Last {period} days
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
        <ButtonLink href={BASE} size="sm" variant="outline">
          Reset
        </ButtonLink>
      </form>

      <section id="sessions" aria-labelledby="sessions-title" className="mb-10 scroll-mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sessions-title" className="text-xl font-black text-gray-950">
            Run sessions
          </h2>
          <p className="text-xs text-gray-500">Lost and open runs first, then newest · start position rounded to ~110 m</p>
        </div>
        {sessions.length === 0 ? (
          <EmptyState icon={Activity} title="No recordings" description="Recordings started in the app (0.8.2 and later) show up here, saved or not." />
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-600">
                  {["Status", "Runner", "Started", "Sport", "Recorded", "Auto-pauses", "Device · app", "Phone state at start"].map((label) => (
                    <th key={label} scope="col" className="px-3.5 py-2.5 font-semibold">
                      {label}
                    </th>
                  ))}
                  <th scope="col" className="px-3.5 py-2.5">
                    <span className="sr-only">Links</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <SessionRow key={session.id} session={session} days={days} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="reports" aria-labelledby="reports-title" className="mb-10 scroll-mt-6">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reports-title" className="text-xl font-black text-gray-950">
            Crash &amp; issue reports
          </h2>
          <form action={`${BASE}#reports`} className="flex flex-wrap items-center gap-2">
            {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
            <input type="hidden" name="days" value={days} />
            <SelectFilter
              name="kind"
              label="All kinds"
              defaultValue={params.kind}
              options={[
                { value: "CRASH", label: "Crashes" },
                { value: "PROCESS_EXIT", label: "OS process exits" },
                { value: "ISSUE", label: "Issues" },
              ]}
            />
            <Button type="submit" size="sm" variant="secondary">
              Apply
            </Button>
          </form>
        </div>
        <p className="mb-3 text-xs text-gray-500">Grouped by problem (same code, exception and top frames). Open a group for its latest report.</p>
        {groups.length === 0 ? (
          <EmptyState icon={AlertOctagon} title="No reports" description="Crashes, OS kills and recorder issues reported by the app will show up here." />
        ) : (
          <div className="grid gap-3">
            {groups.map((group, index) => (
              <DiagnosticGroupCard key={group.fingerprint} group={group} open={index === 0} />
            ))}
          </div>
        )}
      </section>

      <section id="distance" aria-labelledby="distance-title" className="scroll-mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="distance-title" className="text-xl font-black text-gray-950">
            Distance corrections
          </h2>
          <p className="text-xs text-gray-500">Algorithm v{distance.algoVersion} · upward only · phone value kept on every run</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="min-w-0 flex-[1_1_420px] rounded-lg border border-gray-200 bg-white shadow-sm">
            <h3 className="px-4 pb-1 pt-3.5 text-sm font-black text-gray-950">Calibration by phone and build</h3>
            <p className="px-4 pb-2.5 text-xs text-gray-500">Phone ÷ route, median. 1.00 is perfect; below it the phone under-counts.</p>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-600">
                    <th scope="col" className="px-4 py-2 font-semibold">Device · app</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Sport</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Runs</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Corrected</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Median ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {distance.calibration.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No evaluated runs yet.</td>
                    </tr>
                  ) : (
                    distance.calibration.map((row) => {
                      const off = row.medianRatio != null && Math.abs(row.medianRatio - 1) > 0.1;
                      return (
                        <tr key={`${row.deviceModel}-${row.appVersion}-${row.sport}`} className="border-t border-gray-100">
                          <td className="px-4 py-2.5">
                            {row.deviceModel ?? "Unknown device"} · {row.appVersion ?? "pre-telemetry"}
                          </td>
                          <td className="px-4 py-2.5">{sportLabel(row.sport)}</td>
                          <td className="px-4 py-2.5 text-right">{row.runs}</td>
                          <td className={`px-4 py-2.5 text-right ${row.applied > 0 ? "font-semibold text-brand-orangeText" : ""}`}>{row.applied}</td>
                          <td className={`px-4 py-2.5 text-right ${off ? "font-semibold text-red-700" : ""}`}>
                            {row.medianRatio == null ? "—" : row.medianRatio.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-w-0 flex-[1_1_520px] rounded-lg border border-gray-200 bg-white shadow-sm">
            <h3 className="px-4 pb-2.5 pt-3.5 text-sm font-black text-gray-950">Corrected and flagged runs</h3>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-600">
                    <th scope="col" className="px-4 py-2 font-semibold">Decision</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Run</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Phone</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Route</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {distance.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Nothing corrected or flagged.</td>
                    </tr>
                  ) : (
                    distance.rows.map((row) => (
                      <tr key={row.runId} className="border-t border-gray-100">
                        <td className="px-4 py-2.5">
                          <Badge variant={row.decision === "APPLIED" ? "green" : "orange"}>{row.decision === "APPLIED" ? "Corrected" : "Flagged"}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {sportLabel(row.sport)} · {formatShortDate(row.startedAt)} · {row.userName}
                        </td>
                        <td className="px-4 py-2.5 text-right">{row.deviceKm.toFixed(2)} km</td>
                        <td className={`px-4 py-2.5 text-right ${row.decision === "APPLIED" ? "font-semibold" : ""}`}>{row.routeKm.toFixed(2)} km</td>
                        <td className="px-4 py-2.5 text-gray-600">{REASON_LABELS[row.reason] ?? row.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

const STATUS_BADGES: Record<string, { label: string; variant: "red" | "green" | "default" | "blue" | "orange" }> = {
  ABANDONED: { label: "Lost", variant: "red" },
  STARTED: { label: "Open", variant: "blue" },
  FINISHED: { label: "Finished, not saved", variant: "orange" },
  DISCARDED: { label: "Discarded", variant: "default" },
  SAVED: { label: "Saved", variant: "green" },
};

const KIND_BADGES: Record<string, { label: string; variant: "red" | "orange" }> = {
  CRASH: { label: "Crash", variant: "red" },
  PROCESS_EXIT: { label: "OS process exit", variant: "orange" },
  ISSUE: { label: "Issue", variant: "red" },
};

const ISSUE_DESCRIPTIONS: Record<string, string> = {
  "service.restarted_without_run": "The OS restarted the recording service after killing the app mid-run",
  "recorder.restored_interrupted": "A recording interrupted by a process death was restored for saving",
  "recorder.snapshot_failed": "The in-progress recording could not be written to disk",
  "recorder.outbox_unreadable": "A saved recording on the phone could not be read",
  "service.no_location_permission": "Recording started without location permission",
  "service.location_security_exception": "Location updates were refused by the OS",
  "run.save_failed": "Saving a finished run failed",
};

const REASON_LABELS: Record<string, string> = {
  device_undercounted: "Phone under-counted",
  device_overcounted: "Phone longer than its route",
  non_foot_speeds: "Route moves like a vehicle",
  implausible_speed: "Corrected pace would be implausible",
  no_moving_time: "No moving time to correct with",
};

function sportLabel(sport: string) {
  return sport.charAt(0) + sport.slice(1).toLowerCase();
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Algiers" }).format(value);
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" }).format(value);
}

function formatDuration(seconds: unknown) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function yesNo(value: unknown, yes: string, no: string) {
  return value === true ? yes : value === false ? no : null;
}

function SessionRow({ session, days }: { session: AdminRunSessionRow; days: number }) {
  const status = STATUS_BADGES[session.status] ?? { label: session.status, variant: "default" as const };
  const distanceM = num(session.summary.distanceM);
  const battery = num(session.device.batteryPct);
  const stationary = num(session.summary.stationaryAutoPauses);
  const vehicle = num(session.summary.vehicleAutoPauses);
  const ended = session.endedAt ? `${session.endReason?.toLowerCase().replace(/_/g, " ") ?? "ended"} ${formatClock(session.endedAt).split(", ").pop()}` : "ended — never";
  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-3.5 py-3">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="px-3.5 py-3">
        <span className="font-semibold">{session.userName}</span>
        <br />
        <span className="text-gray-500">{session.userEmail}</span>
      </td>
      <td className="px-3.5 py-3">
        {formatClock(session.startedAt)}
        <br />
        <span className="text-gray-500">{ended}</span>
      </td>
      <td className="px-3.5 py-3">{sportLabel(session.sport)}</td>
      <td className="px-3.5 py-3">
        {distanceM == null ? "—" : `${(distanceM / 1000).toFixed(2)} km`} · {formatDuration(session.summary.elapsedSeconds)}
        <br />
        {session.correctedKm != null ? (
          <a href="#distance" className="text-xs font-semibold text-brand-teal">
            corrected → {session.correctedKm.toFixed(2)} km
          </a>
        ) : (
          <span className="text-gray-500">{num(session.summary.routePoints) ?? 0} points</span>
        )}
      </td>
      <td className="px-3.5 py-3">
        {stationary == null ? (
          "—"
        ) : (
          <>
            <span className={stationary >= 10 ? "font-semibold text-brand-orangeText" : ""}>{stationary}</span> standing · {vehicle ?? 0} vehicle
          </>
        )}
      </td>
      <td className="px-3.5 py-3">
        {session.deviceModel ?? "Unknown device"}
        <br />
        <span className="text-gray-500">
          {session.appVersion ?? "—"}
          {session.osVersion ? ` · Android ${session.osVersion}` : ""}
        </span>
      </td>
      <td className="px-3.5 py-3">
        {[battery != null ? `Battery ${battery} %` : null, yesNo(session.device.powerSave, "saver on", "saver off")].filter(Boolean).join(" · ") || "—"}
        <br />
        <span className="text-gray-500">
          {[
            typeof session.device.network === "string" ? session.device.network : null,
            yesNo(session.device.locationEnabled, "location on", "location off"),
            num(session.device.thermalStatus) != null ? `thermal ${session.device.thermalStatus}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </td>
      <td className="px-3.5 py-3">
        {session.reportCount > 0 ? (
          <a href={`${BASE}?q=${session.clientId}&days=${days}#reports`} className="font-semibold text-brand-teal">
            {session.reportCount} {session.reportCount === 1 ? "report" : "reports"}
          </a>
        ) : null}
      </td>
    </tr>
  );
}

function deviceLines(device: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const battery = num(device.batteryPct);
  const temp = num(device.batteryTempC);
  lines.push(
    [battery != null ? `Battery ${battery} %` : null, yesNo(device.charging, "charging", "not charging"), temp != null ? `${temp} °C` : null]
      .filter(Boolean)
      .join(" · ")
  );
  lines.push(
    [yesNo(device.powerSave, "Power saver on", "Power saver off"), yesNo(device.ignoringBatteryOptimizations, "ignoring battery optimisation", "not ignoring battery optimisation")]
      .filter(Boolean)
      .join(" · ")
  );
  lines.push(
    [
      num(device.thermalStatus) != null ? `Thermal ${device.thermalStatus}` : null,
      num(device.standbyBucket) != null ? `standby bucket ${device.standbyBucket}` : null,
      yesNo(device.backgroundRestricted, "background restricted", "not restricted"),
    ]
      .filter(Boolean)
      .join(" · ")
  );
  const avail = num(device.memAvailMb);
  const total = num(device.memTotalMb);
  const disk = num(device.freeDiskMb);
  lines.push(
    [avail != null && total != null ? `RAM ${(avail / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB free` : null, disk != null ? `disk ${(disk / 1024).toFixed(0)} GB free` : null]
      .filter(Boolean)
      .join(" · ")
  );
  lines.push(
    [
      typeof device.network === "string" ? `${device.network}${device.networkValidated === true ? " validated" : ""}` : null,
      yesNo(device.locationEnabled, "location on", "location off"),
      yesNo(device.gpsProviderEnabled, "GPS on", "GPS off"),
    ]
      .filter(Boolean)
      .join(" · ")
  );
  return lines.filter((line) => line.length > 0);
}

function contextLines(group: AdminDiagnosticGroup): string[] {
  const c = group.latest.context;
  const lines: string[] = [];
  if (typeof c.reason === "string") lines.push(`Reason ${c.reason}${num(c.status) != null ? ` (status ${c.status})` : ""}`);
  if (num(c.importance) != null) lines.push(`Importance ${c.importance} · foreground service: ${c.wasForegroundService === true ? "yes" : "no"}`);
  if (num(c.rssKb) != null) lines.push(`RSS ${Math.round((c.rssKb as number) / 1024)} MB`);
  if (typeof c.runInterrupted === "boolean") lines.push(`Run interrupted: ${c.runInterrupted ? "yes" : "no"}`);
  if (typeof c.recorderStatus === "string") {
    lines.push(`Recorder ${c.recorderStatus.toLowerCase()} · ${num(c.recorderDistanceM) ?? 0} m · ${num(c.recorderRoutePoints) ?? 0} points`);
  }
  if (typeof c.code === "string") lines.push(`API code ${c.code}`);
  return lines;
}

function breadcrumbs(context: Record<string, unknown>): string[] {
  const crumbs = Array.isArray(context.breadcrumbs) ? context.breadcrumbs.filter((c): c is string => typeof c === "string") : [];
  // "2026-11-14T16:58:40.123Z message" → "16:58:40 message"
  return crumbs.slice(-10).map((crumb) => crumb.replace(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})\S*\s/, "$1 "));
}

function DiagnosticGroupCard({ group, open }: { group: AdminDiagnosticGroup; open: boolean }) {
  const kind = KIND_BADGES[group.kind] ?? { label: group.kind, variant: "red" as const };
  const heading = group.latest.message ?? ISSUE_DESCRIPTIONS[group.code] ?? group.code;
  const versions = group.appVersions.length > 1 ? `${group.appVersions[0]}–${group.appVersions.at(-1)}` : group.appVersions[0] ?? "unknown build";
  const device = deviceLines(group.latest.device);
  const exit = contextLines(group);
  const crumbs = breadcrumbs(group.latest.context);
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={kind.variant}>{kind.label}</Badge>
            <span className="font-mono text-xs text-gray-600">{group.code}</span>
            <Badge variant="blue">android</Badge>
          </div>
          <h3 className="break-words text-sm font-black text-gray-950">{heading}</h3>
          <p className="text-xs text-gray-500">
            {group.count} {group.count === 1 ? "report" : "reports"} · {group.runners} {group.runners === 1 ? "runner" : "runners"} · {group.devices.join(", ")} · {versions} ·{" "}
            {group.duringRun > 0 ? `${group.duringRun} during a recording` : "not during a recording"}
            {group.sampled ? " · runner, device and recording figures from the newest 1,000 reports" : ""}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs text-gray-500">
          <span className="font-semibold text-gray-700">Last {formatClock(group.lastAt)}</span>
          {group.count > 1 ? (
            <>
              <br />
              first {formatClock(group.firstAt)}
            </>
          ) : null}
        </p>
      </div>
      <details className="mt-2" open={open}>
        <summary className="cursor-pointer text-xs font-bold text-brand-teal">Latest report</summary>
        <p className="mt-2 text-xs text-gray-500">
          {group.latest.userName ? (
            <>
              <span className="font-semibold text-gray-700">{group.latest.userName}</span> · {group.latest.userEmail}
            </>
          ) : (
            "Not signed in"
          )}
          {group.latest.osVersion ? ` · Android ${group.latest.osVersion}` : ""}
          {group.latest.runClientId ? (
            <>
              {" "}
              · run <span className="font-mono">{group.latest.runClientId.slice(0, 8)}</span>
            </>
          ) : null}
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <InfoBlock title="Device" lines={device} />
          <InfoBlock title={group.kind === "PROCESS_EXIT" ? "Exit" : "Context"} lines={exit.length > 0 ? exit : ["—"]} />
          <InfoBlock title="Breadcrumbs" lines={crumbs.length > 0 ? crumbs : ["—"]} mono />
        </div>
        {group.latest.stackTrace ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-bold text-brand-teal">Stack trace</summary>
            <pre className="mt-1.5 max-h-72 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] leading-5 text-gray-700">{group.latest.stackTrace}</pre>
          </details>
        ) : null}
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold text-brand-teal">Raw report</summary>
          <pre className="mt-1.5 max-h-72 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] leading-5 text-gray-700">
            {JSON.stringify({ device: group.latest.device, context: group.latest.context }, null, 2)}
          </pre>
        </details>
      </details>
    </article>
  );
}

function InfoBlock({ title, lines, mono = false }: { title: string; lines: string[]; mono?: boolean }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-700">
      <p className="mb-1 font-semibold text-gray-900">{title}</p>
      {lines.map((line, index) => (
        <p key={index} className={mono ? "break-words font-mono text-[11px]" : "break-words"}>
          {line}
        </p>
      ))}
    </div>
  );
}
