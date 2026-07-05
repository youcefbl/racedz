"use server";

import { redirect } from "next/navigation";
import { recordAdminAuditLog, requireAdmin } from "@/lib/admin";
import {
  audienceSchema,
  composeSchema,
  createBroadcastDraft,
  dispatchBroadcast,
  estimateAudience,
  startBroadcast,
  type BroadcastAudience,
  type ComposeInput
} from "@/lib/broadcasts";

/** Live recipient count for the compose preview (called imperatively from the client form). */
export async function estimateAudienceAction(audience: BroadcastAudience): Promise<number> {
  await requireAdmin();
  return estimateAudience(audienceSchema.parse(audience));
}

export async function saveBroadcastDraftAction(input: ComposeInput) {
  const session = await requireAdmin();
  const parsed = composeSchema.parse(input);
  const draft = await createBroadcastDraft(parsed, session.user.id);
  await recordAdminAuditLog({
    actorId: session.user.id,
    action: "broadcast.drafted",
    targetType: "Broadcast",
    targetId: draft.id,
    summary: parsed.title
  });
  redirect("/admin/announcements");
}

export async function sendBroadcastAction(input: ComposeInput) {
  const session = await requireAdmin();
  const parsed = composeSchema.parse(input);
  const draft = await createBroadcastDraft(parsed, session.user.id);
  const { totalRecipients } = await startBroadcast(draft.id);
  await recordAdminAuditLog({
    actorId: session.user.id,
    action: "broadcast.sent",
    targetType: "Broadcast",
    targetId: draft.id,
    summary: parsed.title,
    metadata: { totalRecipients, channels: parsed.channels }
  });
  // Best-effort inline first batch; the CRON_SECRET dispatch endpoint drains the rest.
  await dispatchBroadcast(draft.id).catch(() => {});
  redirect("/admin/announcements");
}
