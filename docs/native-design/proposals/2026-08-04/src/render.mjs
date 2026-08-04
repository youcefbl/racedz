// Render mockup HTML files to PNG at the device's true viewport (1080×2340 = 393×851 @ 2.75x).
// Usage: node render.mjs [name ...]   (default: all entries)
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..");

/** [htmlFile, outputBaseName, themes[], rtl] */
const ENTRIES = [
  ["runs-a.html", "runs-A-hero-top", ["light", "dark", "race"], false],
  ["runs-b.html", "runs-B-sticky", ["light", "dark", "race"], false],
  ["runs-c.html", "runs-C-restructure", ["light", "dark", "race"], false],
  ["runs-b-ar.html", "runs-B-sticky-ar", ["light"], true],
  ["runs-empty.html", "runs-empty", ["light", "dark", "race"], false],
  ["coach.html", "coach", ["light", "dark", "race"], false],
  ["runs-b-annotated.html", "runs-B-annotated", ["light"], false],
  ["coach-annotated.html", "coach-annotated", ["light"], false],
  ["run-start-hold.html", "run-start-hold", ["dark", "race"], false, { w: 1275, h: 900 }],
  ["run-live.html", "run-live", ["dark", "race"], false],
  ["run-detail.html", "run-detail", ["light", "dark", "race"], false, { w: 393, h: 1780 }],
  ["run-live-states.html", "run-live-states", ["dark"], false, { w: 2080, h: 800 }],
  ["dock-states.html", "dock-states", ["light"], false, { w: 1720, h: 420 }],
  ["runs-b-fr.html", "runs-B-sticky-fr", ["light"], false],
  ["runs-b-large.html", "runs-B-sticky-large", ["light"], false],
];

const only = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 393, height: 851 },
  deviceScaleFactor: 2.75,
});

for (const [file, base, themes, rtl, vp] of ENTRIES) {
  if (only.length && !only.some((o) => file.startsWith(o) || base.startsWith(o))) continue;
  for (const theme of themes) {
    await page.setViewportSize(vp ? { width: vp.w, height: vp.h } : { width: 393, height: 851 });
    await page.goto("file://" + path.join(here, file));
    await page.evaluate(
      ([t, r]) => {
        document.documentElement.setAttribute("data-theme", t);
        if (r) document.documentElement.setAttribute("dir", "rtl");
      },
      [theme, rtl],
    );
    await page.waitForTimeout(250);
    const dest = path.join(out, `${base}-${theme}.png`);
    await page.screenshot({ path: dest });
    console.log("rendered", path.basename(dest));
  }
}
await browser.close();
