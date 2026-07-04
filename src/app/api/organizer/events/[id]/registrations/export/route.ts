import { getOrganizerRaceById, getOrganizerRaceRegistrations, requireApprovedOrganizer } from "@/lib/organizer";

type ExportContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: ExportContext) {
  const { id } = await context.params;
  const { organization } = await requireApprovedOrganizer();
  const [race, registrationResult] = await Promise.all([
    getOrganizerRaceById(organization.id, id),
    getOrganizerRaceRegistrations(organization.id, id, {}, { page: 1, limit: 10000, skip: 0 })
  ]);

  if (!race) {
    return new Response("Race not found", { status: 404 });
  }

  const registrations = registrationResult.items;
  const rows = [
    ["raceTitle", "firstName", "lastName", "email", "phone", "category", "distanceKm", "status", "paymentStatus", "createdAt"],
    ...registrations.map((registration) => [
      race.title,
      registration.user.firstName,
      registration.user.lastName,
      registration.user.email,
      registration.user.phone ?? "",
      registration.raceCategory.name,
      String(registration.raceCategory.distanceKm),
      registration.status,
      registration.paymentStatus,
      registration.createdAt.toISOString()
    ])
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${race.slug}-registrations.csv"`
    }
  });
}

// Runner-controlled fields (name, email, phone) end up in a file an organizer opens
// in Excel/Sheets. Neutralize two attack classes:
//  1. Formula injection: a value starting with = + - @ (or a leading tab/CR) is treated
//     as a formula by spreadsheets — prefix a single quote so it renders as literal text.
//  2. CSV structure breakout: quote-wrap anything containing a delimiter, quote, or any
//     newline (\n OR bare \r) so it can't inject extra rows/columns.
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCsv(value: string) {
  let v = value ?? "";
  if (CSV_FORMULA_PREFIX.test(v)) {
    v = `'${v}`;
  }
  if (/[",\n\r]/.test(v)) {
    v = `"${v.replaceAll("\"", "\"\"")}"`;
  }
  return v;
}
