import { getOrganizerRaceById, getOrganizerRaceRegistrations, requireApprovedOrganizer } from "@/lib/organizer";

type ExportContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: ExportContext) {
  const { id } = await context.params;
  const { organization } = await requireApprovedOrganizer();
  const [race, registrations] = await Promise.all([
    getOrganizerRaceById(organization.id, id),
    getOrganizerRaceRegistrations(organization.id, id)
  ]);

  if (!race) {
    return new Response("Race not found", { status: 404 });
  }

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

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}
