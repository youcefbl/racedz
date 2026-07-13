import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  { name: "home", path: "/", heading: "main h1" },
  { name: "races", path: "/races", heading: "main h1" },
  { name: "login", path: "/login", heading: "main h1" }
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 }
] as const;

const THEMES = ["light", "dark", "race"] as const;

test.describe("responsive UI quality", () => {
  for (const viewport of VIEWPORTS) {
    for (const pageCase of PAGES) {
      test(`${pageCase.name} has no structural UI regression at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(pageCase.path);
        await waitForStablePage(page);

        await expect(page.locator(pageCase.heading).first()).toBeVisible();
        await assertNoHorizontalOverflow(page);
        await assertAccessibleNames(page);

        if (viewport.name === "mobile") {
          await assertMobileTouchTargets(page);
        }
      });
    }
  }

  test("mobile navigation opens without clipping the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForStablePage(page);

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await menuButton.click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertMobileTouchTargets(page);

    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
  });

  test("Arabic pages set RTL and stay inside the mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/races?lang=ar");
    await waitForStablePage(page);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await assertNoHorizontalOverflow(page);
    await assertMobileTouchTargets(page);
  });
});

test.describe("visual regression snapshots", () => {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const pageCase of PAGES) {
        test(`${pageCase.name} ${viewport.name} ${theme} matches its visual baseline`, async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.addInitScript((selectedTheme) => {
            window.localStorage.setItem("racedz-theme", selectedTheme);
          }, theme);
          await page.goto(pageCase.path);
          await waitForStablePage(page);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expect(page).toHaveScreenshot(`${pageCase.name}-${viewport.name}-${theme}.png`, {
            animations: "disabled",
            caret: "hide",
            fullPage: true,
            maxDiffPixels: 200
          });
        });
      }
    }
  }
});

async function waitForStablePage(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `
  });
  await page.evaluate(() => document.fonts?.ready);
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));

  expect(dimensions.content, `horizontal overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(
    dimensions.viewport + 1
  );
}

async function assertMobileTouchTargets(page: Page) {
  const violations = await page.locator('button, input, select, textarea, [role="button"]').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const htmlElement = element as HTMLElement;
      const type = htmlElement.getAttribute("type");
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();

      if (
        type === "hidden" ||
        type === "checkbox" ||
        type === "radio" ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        rect.width === 0 ||
        rect.height === 0 ||
        htmlElement.closest("nextjs-portal") ||
        htmlElement.getAttribute("aria-label") === "Open Next.js Dev Tools"
      ) {
        return [];
      }

      return rect.width >= 40 && rect.height >= 40
        ? []
        : [
            {
              tag: htmlElement.tagName,
              text: htmlElement.textContent?.trim().slice(0, 40),
              ariaLabel: htmlElement.getAttribute("aria-label"),
              className: htmlElement.className,
              width: rect.width,
              height: rect.height
            }
          ];
    })
  );

  expect(violations, "mobile controls should be at least 40px tall and wide").toEqual([]);
}

async function assertAccessibleNames(page: Page) {
  const missingNames = await page.locator("button, a").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const htmlElement = element as HTMLElement;
      const name = htmlElement.getAttribute("aria-label") || htmlElement.textContent?.trim() || htmlElement.getAttribute("title");
      return name ? [] : [{ tag: htmlElement.tagName, html: htmlElement.outerHTML.slice(0, 160) }];
    })
  );

  expect(missingNames, "interactive links and buttons should have accessible names").toEqual([]);
}
