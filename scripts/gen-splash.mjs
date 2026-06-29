// Generates the ZidRun Android splash screens (Capacitor legacy splash drawables)
// from the official wordmark, centered on the dark brand background.
// Run: node scripts/gen-splash.mjs
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { dirname } from "path";

// Pull the wordmark straight from the app's brand artwork so the splash always
// matches the in-app logo. `currentColor` (the "idRun" ink) -> white on dark.
const tsSrc = readFileSync("src/components/layout/zidrun-logo-svg.ts", "utf8");
const match = tsSrc.match(/ZIDRUN_LOGO_SVG\s*=\s*`([\s\S]*?)`/);
if (!match) throw new Error("ZIDRUN_LOGO_SVG not found in zidrun-logo-svg.ts");
const wordmark = match[1].replace(/currentColor/g, "#ffffff");

const BG = { r: 0x0c, g: 0x11, b: 0x16, alpha: 1 }; // #0c1116 — matches public/icon.svg
const ASPECT = 2172 / 724; // wordmark viewBox ratio

// Portrait density buckets (Android maps land-* to the swapped dimensions).
const buckets = [
  ["mdpi", 320, 480],
  ["hdpi", 480, 800],
  ["xhdpi", 720, 1280],
  ["xxhdpi", 960, 1600],
  ["xxxhdpi", 1280, 1920]
];

async function renderLogo(targetWidth) {
  return sharp(Buffer.from(wordmark)).resize({ width: Math.round(targetWidth) }).png().toBuffer();
}

async function makeSplash(width, height, outPath) {
  // Wordmark fills ~62% of the short edge of room while staying within both axes.
  const byWidth = width * 0.62;
  const byHeight = height * 0.32 * ASPECT;
  const logo = await renderLogo(Math.min(byWidth, byHeight));
  const meta = await sharp(logo).metadata();
  const left = Math.round((width - meta.width) / 2);
  const top = Math.round((height - meta.height) / 2);
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp({ create: { width, height, channels: 4, background: BG } })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(outPath);
  console.log("wrote", outPath, `${width}x${height}`);
}

const RES = "android/app/src/main/res";

for (const [name, w, h] of buckets) {
  await makeSplash(w, h, `${RES}/drawable-port-${name}/splash.png`);
  await makeSplash(h, w, `${RES}/drawable-land-${name}/splash.png`);
}
// Density-agnostic fallback used by the launch theme background.
await makeSplash(1920, 1920, `${RES}/drawable/splash.png`);
