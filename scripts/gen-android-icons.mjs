// Generates the ZidRun Android launcher icons (adaptive + legacy) from the brand
// artwork, replacing the default Capacitor placeholder.
// Run: node scripts/gen-android-icons.mjs
import sharp from "sharp";
import { readFileSync } from "fs";

const RES = "android/app/src/main/res";

// Green/orange "Z" mark (no background) for the adaptive foreground.
const tsSrc = readFileSync("src/components/layout/zidrun-logo-svg.ts", "utf8");
const markMatch = tsSrc.match(/ZIDRUN_MARK_SVG\s*=\s*`([\s\S]*?)`/);
if (!markMatch) throw new Error("ZIDRUN_MARK_SVG not found");
const mark = markMatch[1];

// Full icon (Z on the dark rounded square) for legacy pre-API-26 launchers.
const iconSvg = readFileSync("public/icon.svg", "utf8");

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Adaptive foreground: 108dp canvas; keep the mark inside the ~66% safe zone.
const foreground = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [density, size] of Object.entries(foreground)) {
  const inner = Math.round(size * 0.62);
  const offset = Math.round((size - inner) / 2);
  const logo = await sharp(Buffer.from(mark))
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(`${RES}/mipmap-${density}/ic_launcher_foreground.png`);
  console.log("wrote", `mipmap-${density}/ic_launcher_foreground.png`, `${size}x${size}`);
}

// Legacy square + round launcher icons (the OS applies its own mask).
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(legacy)) {
  const buf = await sharp(Buffer.from(iconSvg)).resize(size, size).png().toBuffer();
  await sharp(buf).toFile(`${RES}/mipmap-${density}/ic_launcher.png`);
  await sharp(buf).toFile(`${RES}/mipmap-${density}/ic_launcher_round.png`);
  console.log("wrote", `mipmap-${density}/ic_launcher{,_round}.png`, `${size}x${size}`);
}
