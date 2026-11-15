/**
 * Generates the bundled run-voice clips (see run-cue-vocabulary.ts) into the native app's assets:
 *
 *   native-android/feature/runs/src/main/assets/cues/<locale>/<key>.mp3
 *   native-android/feature/runs/src/main/assets/cues/<locale>/manifest.json   (key → text, hash)
 *
 * Idempotent: a clip is only re-synthesized when its text, voice, model or delivery note changed,
 * so editing one phrase costs one call. Needs OPENAI_API_KEY and ffmpeg.
 *
 *   npx tsx --env-file=.env scripts/generate-run-cue-clips.ts [--locale ar] [--keys a,b] [--force] [--dry-run]
 *
 * Each clip is synthesized as WAV, trimmed of the provider's leading/trailing silence (clips are
 * joined back to back on the phone, so padding would become audible gaps), loudness-normalised so
 * a number never sounds quieter than the word before it, and encoded as small mono MP3 — a format
 * every Android version's MediaPlayer plays.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { CUE_LOCALES, VOICE_INSTRUCTIONS, vocabularyFor, type CueLocale } from "./run-cue-vocabulary";

const MODEL = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
const VOICE = "alloy"; // same voice as the server's cue fallback (src/lib/coach/tts.ts)
const CONCURRENCY = 6;
const OUT_ROOT = path.join(process.cwd(), "native-android/feature/runs/src/main/assets/cues");

type ManifestEntry = { text: string; hash: string };
type Manifest = Record<string, ManifestEntry>;

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const onlyLocale = args.includes("--locale") ? (args[args.indexOf("--locale") + 1] as CueLocale) : null;
// A sample run for listening checks: only these keys are synthesized and the manifest is untouched.
const onlyKeys = args.includes("--keys") ? new Set(args[args.indexOf("--keys") + 1].split(",")) : null;

function hashFor(locale: CueLocale, text: string): string {
  return createHash("sha256").update(JSON.stringify([MODEL, VOICE, VOICE_INSTRUCTIONS[locale], text])).digest("hex").slice(0, 16);
}

const MIN_CLIP_SECONDS = 0.3;

function durationOf(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number.parseFloat(out.toString()) || 0;
}

function postProcess(wav: Buffer, outFile: string) {
  const work = path.join(tmpdir(), `cue-${process.pid}-${Math.random().toString(36).slice(2)}.wav`);
  writeFileSync(work, wav);
  try {
    // Trim silence at both ends (reverse trick for the tail), normalise loudness, keep a short
    // natural tail so joined clips breathe rather than run together.
    // Loudness first, then trim: trimming a quiet raw clip at a fixed threshold removed whole
    // words (8 clips came out empty on the first full run).
    const filter = [
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03",
      "areverse",
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06",
      "areverse",
      "apad=pad_dur=0.06",
    ].join(",");
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", work,
      "-af", filter, "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "40k", outFile,
    ]);
  } finally {
    rmSync(work, { force: true });
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !dryRun) throw new Error("OPENAI_API_KEY is not set (run with --env-file=.env).");
  const client = new OpenAI({ apiKey: apiKey ?? "dry-run", timeout: 60_000, maxRetries: 3 });

  let synthesized = 0;
  let characters = 0;
  for (const locale of CUE_LOCALES) {
    if (onlyLocale && locale !== onlyLocale) continue;
    const dir = path.join(OUT_ROOT, locale);
    mkdirSync(dir, { recursive: true });
    const manifestFile = path.join(dir, "manifest.json");
    const previous: Manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
    const vocabulary = vocabularyFor(locale);
    const next: Manifest = {};

    const todo = Object.entries(vocabulary).filter(([key, text]) => {
      const hash = hashFor(locale, text);
      next[key] = { text, hash };
      if (onlyKeys) return onlyKeys.has(key);
      return force || previous[key]?.hash !== hash || !existsSync(path.join(dir, `${key}.mp3`));
    });
    console.log(`${locale}: ${Object.keys(vocabulary).length} clips, ${todo.length} to synthesize`);
    if (dryRun) {
      todo.forEach(([key, text]) => console.log(`  ${key}: ${text}`));
      continue;
    }

    let cursor = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < todo.length) {
        const [key, text] = todo[cursor++];
        const outFile = path.join(dir, `${key}.mp3`);
        // A clip that comes out (nearly) empty is retried, then fails the run — never shipped.
        for (let attempt = 1; ; attempt++) {
          const response = await client.audio.speech.create({
            model: MODEL,
            voice: VOICE,
            input: text,
            instructions: VOICE_INSTRUCTIONS[locale],
            response_format: "wav",
          });
          postProcess(Buffer.from(await response.arrayBuffer()), outFile);
          if (durationOf(outFile) >= MIN_CLIP_SECONDS) break;
          if (attempt >= 3) throw new Error(`${locale}/${key} ("${text}") is empty after ${attempt} attempts`);
        }
        synthesized++;
        characters += text.length;
        if (synthesized % 25 === 0) console.log(`  … ${synthesized} done`);
      }
    }));

    if (onlyKeys) continue;
    // Clips no longer in the vocabulary are removed so the APK carries only what is spoken.
    for (const key of Object.keys(previous)) {
      if (!(key in next)) rmSync(path.join(dir, `${key}.mp3`), { force: true });
    }
    writeFileSync(manifestFile, `${JSON.stringify(next, null, 1)}\n`);
  }
  console.log(`Synthesized ${synthesized} clips (${characters} characters) with ${MODEL}/${VOICE}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
