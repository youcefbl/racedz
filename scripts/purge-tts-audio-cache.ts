import { rm, stat } from "fs/promises";
import path from "path";

// One-shot deploy cleanup (review DD6-R01): before the allowlist existed, the TTS endpoint cached
// synthesized audio of ARBITRARY user text under public/uploads/tts-audio, and that prefix was
// publicly served. The Caddyfile now 403s it, but the files themselves are unreviewable user
// content rendered as audio and nothing will ever read them again (the current cache lives at
// uploads/tts-cache, keyed differently) — so delete the directory outright. Idempotent: a missing
// directory is success.
async function main() {
  const dir = path.join(process.cwd(), "public", "uploads", "tts-audio");
  try {
    await stat(dir);
  } catch {
    console.log(`Nothing to purge — ${dir} does not exist.`);
    return;
  }
  await rm(dir, { recursive: true, force: true });
  console.log(`Purged legacy TTS cache at ${dir}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
