type ExportContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: ExportContext) {
  const { id } = await context.params;
  const csv = ["raceEventId,firstName,lastName,email,status", `${id},Sample,Runner,runner@example.com,PENDING`].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}-registrations.csv"`
    }
  });
}
