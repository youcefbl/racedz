// Compose before→after pairs: device capture beside proposal render at identical display size.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..");
const cur = path.join(here, "../../../current/2026-08-04");

const PAIRS = [
  ["pair-runs-light", path.join(cur, "runs-overview-light.png"), path.join(out, "runs-B-sticky-light.png"), "Current — Runs overview (device, light)", "Proposed — Variant B (light)"],
  ["pair-runs-race", path.join(cur, "runs-overview-race.png"), path.join(out, "runs-B-sticky-race.png"), "Current — Runs overview (device, race)", "Proposed — Variant B (race)"],
  ["pair-runs-empty-race", path.join(cur, "runs-overview-empty-race.png"), path.join(out, "runs-empty-race.png"), "Current — empty state (device, race)", "Proposed — empty state (race)"],
  ["pair-coach-light", path.join(cur, "coach-overview-trial-light.png"), path.join(out, "coach-light.png"), "Current — Coach overview (device, light)", "Proposed — Coach overview (light)"],
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 900, height: 1010 }, deviceScaleFactor: 2 });

for (const [name, before, after, lb, la] of PAIRS) {
  const html = `<!doctype html><html><head><style>
    * { margin:0; box-sizing:border-box; }
    body { background:#111827; font-family:sans-serif; padding:20px; display:flex; gap:24px; justify-content:center; }
    figure { display:flex; flex-direction:column; gap:10px; align-items:center; }
    figcaption { color:#E5E7EB; font-size:14px; font-weight:600; }
    img { height:900px; border-radius:18px; box-shadow:0 6px 24px rgba(0,0,0,.5); }
    .arrow { align-self:center; color:#A3E635; font-size:34px; font-weight:700; }
  </style></head><body>
    <figure><figcaption>${lb}</figcaption><img src="file://${before}"></figure>
    <div class="arrow">→</div>
    <figure><figcaption>${la}</figcaption><img src="file://${after}"></figure>
  </body></html>`;
  const tmp = path.join(here, "_pair_tmp.html");
  fs.writeFileSync(tmp, html);
  await page.goto("file://" + tmp);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
  console.log("composed", name + ".png");
}
fs.unlinkSync(path.join(here, "_pair_tmp.html"));
await browser.close();
