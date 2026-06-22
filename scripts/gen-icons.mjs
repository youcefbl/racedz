// Generates RaceDZ PNG app icons from the inline "Velocity" SVG mark.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect x="2" y="2" width="36" height="36" rx="9" fill="#0F766E"/>
  <g fill="none" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 13 L17 20 L10 27" stroke="#ffffff" opacity="0.4"/>
    <path d="M17 13 L24 20 L17 27" stroke="#ffffff" opacity="0.8"/>
    <path d="M24 13 L31 20 L24 27" stroke="#F97316"/>
  </g></svg>`;

// Full-bleed (no rounded corners) for maskable + apple; content kept in the safe zone.
const bleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <rect x="0" y="0" width="40" height="40" fill="#0F766E"/>
  <g fill="none" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 14 L17.5 20 L11 26" stroke="#ffffff" opacity="0.4"/>
    <path d="M17.5 14 L24 20 L17.5 26" stroke="#ffffff" opacity="0.8"/>
    <path d="M24 14 L30.5 20 L24 26" stroke="#F97316"/>
  </g></svg>`;

const jobs = [
  ["public/icon-192.png", rounded, 192],
  ["public/icon-512.png", rounded, 512],
  ["public/maskable-512.png", bleed, 512],
  ["public/apple-icon.png", bleed, 180]
];

for (const [out, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("wrote", out, `${size}x${size}`);
}
