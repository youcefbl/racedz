import { readdir, rm, stat } from "fs/promises";
import path from "path";

// One-shot deploy cleanup (review DD6-R01 / FD1-R03): before the allowlist existed, the TTS
// endpoint cached synthesized audio of ARBITRARY user text under public/uploads/tts-audio, and that
// prefix was publicly served. Caddy now 403s it, but the files themselves are unreviewable user
// content rendered as audio and nothing will ever read them again (the current cache lives at
// uploads/tts-cache, keyed differently) — so the directory is deleted outright.
//
// Runs on every production start (docker-compose.prod.yml), which is why it is idempotent: a
// missing directory is success, and a second run is a no-op.
//
// Failure is deliberately NON-BLOCKING. Access control is the real boundary here and it is already
// in place (the Caddy deny), so refusing to start the site over an undeletable leftover file would
// be disproportionate. A failure prints the marker TTS_PURGE_FAILED with the resolved path, and
// "Required post-deploy check — legacy TTS audio purge" in docs/OPERATIONS.md makes reading that
// line a release step with named remediation — including that a MISSING marker counts as a failure.
async function inventory(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const walk = async (current: string) => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        files += 1;
        bytes += (await stat(full)).size;
      }
    }
  };
  await walk(dir);
  return { files, bytes };
}

async function main() {
  const dir = path.join(process.cwd(), "public", "uploads", "tts-audio");

  try {
    await stat(dir);
  } catch {
    console.log(`TTS_PURGE_OK nothing to purge — ${dir} does not exist.`);
    return;
  }

  const before = await inventory(dir);
  await rm(dir, { recursive: true, force: true });

  // Verify rather than assume: rm(force) does not report what it could not remove.
  let removed = true;
  try {
    await stat(dir);
    removed = false;
  } catch {
    // Gone, as intended.
  }

  if (removed) {
    console.log(`TTS_PURGE_OK removed ${before.files} file(s), ${before.bytes} byte(s) from ${dir}.`);
  } else {
    const after = await inventory(dir);
    console.error(
      `TTS_PURGE_FAILED ${dir} still exists with ${after.files} file(s), ${after.bytes} byte(s). ` +
        `The Caddy deny on /uploads/tts-audio/* still blocks anonymous access; purge manually.`
    );
  }
}

main().catch((error) => {
  // Non-blocking by design (see header): report loudly, let the app start.
  console.error("TTS_PURGE_FAILED", error);
});
