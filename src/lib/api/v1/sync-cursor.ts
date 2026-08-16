import { ApiError } from "@/lib/api/v1/http";

/**
 * The delta cursor: `<ISO updatedAt>|<run id>`. Compound because rows written in one batch (an
 * import, a bulk edit) share an `updatedAt`, and a timestamp-only `>` cursor would skip every
 * sibling of the last row on the page. Older clients may still send the bare timestamp; it is
 * accepted and treated as "everything strictly after it".
 */
export type SyncCursor = { updatedAt: Date; id: string | null };

export function parseSyncCursor(raw: string | null): SyncCursor | null {
  if (!raw) return null;
  const [stamp, id] = raw.split("|");
  const parsed = new Date(stamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError("VALIDATION_FAILED", "updatedSince must be an ISO-8601 timestamp.");
  }
  return { updatedAt: parsed, id: id && id.length > 0 && id.length <= 64 ? id : null };
}

export function encodeSyncCursor(cursor: SyncCursor | null): string | null {
  if (!cursor) return null;
  return cursor.id ? `${cursor.updatedAt.toISOString()}|${cursor.id}` : cursor.updatedAt.toISOString();
}
