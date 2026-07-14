import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { createUniqueRaceSlug } from "@/lib/race-slugs";
import { setRaceOptionalDetails } from "@/lib/race-optional-details";
import type { NormalizedDraft } from "./normalize";

export type ImportProvenance = {
  importSource: string; // INSTAGRAM | FACEBOOK | MANUAL
  importSourceUrl?: string;
  importRawText?: string;
  importExtractionJson: unknown; // raw LLM output, stored for debugging / re-extract
  mainImageUrl?: string;
};

/**
 * Persist a normalised extraction as a DRAFT platform race + its categories, tagged with import
 * provenance. Draft (not published) on purpose: the admin reviews it in the standard edit page and
 * publishes from there. Mirrors createPlatformRace, minus the publish + the raw-SQL category raceType
 * quirk it carries.
 */
export async function createRaceDraftFromImport(draft: NormalizedDraft, provenance: ImportProvenance) {
  const slug = await createUniqueRaceSlug(draft.title);
  const maxParticipants = draft.maxParticipants;

  return getPrisma().$transaction(async (tx) => {
    const race = await tx.raceEvent.create({
      data: {
        source: "PLATFORM",
        status: "DRAFT",
        registrationStatus: "NOT_OPEN",
        title: draft.title,
        slug,
        description: draft.description,
        raceType: draft.raceType,
        startDate: draft.startDate,
        registrationCloseAt: draft.registrationCloseAt,
        wilaya: draft.wilaya,
        city: draft.city,
        commune: draft.commune,
        address: draft.address,
        organizerName: draft.organizerName ?? "ZidRun Community Desk",
        organizerUrl: draft.organizerUrl,
        contactEmail: draft.contactEmail,
        contactPhone: draft.contactPhone,
        baridiMobNumber: draft.baridiMobNumber,
        ccpAccount: draft.ccpAccount,
        ccpKey: draft.ccpKey,
        mainImageUrl: provenance.mainImageUrl,
        maxParticipants,
        availablePlaces: maxParticipants,
        importSource: provenance.importSource,
        importSourceUrl: provenance.importSourceUrl,
        importRawText: provenance.importRawText,
        importExtractionJson: toJsonInput(provenance.importExtractionJson)
      }
    });

    await setRaceOptionalDetails(tx, race.id, {
      elevationGainText: draft.elevationGainText ?? null,
      conditions: null
    });

    for (const category of draft.categories) {
      const created = await tx.raceCategory.create({
        data: {
          raceEventId: race.id,
          name: category.name,
          distanceKm: category.distanceKm,
          priceDzd: category.priceDzd,
          startTime: category.startTime
        }
      });

      // Same quirk as createPlatformRace: RaceCategory.raceType is written via raw SQL.
      await tx.$executeRaw`
        UPDATE "RaceCategory"
        SET "raceType" = ${category.raceType}::"RaceType"
        WHERE "id" = ${created.id}
      `;
    }

    return race;
  });
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  // Round-trip through JSON so undefined/functions/etc. are dropped to a plain JSON value.
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
