const baseUrl = process.env.RACEDZ_BASE_URL ?? "http://127.0.0.1:3003";

type SmokeCheck = {
  name: string;
  run: () => Promise<void>;
};

const checks: SmokeCheck[] = [
  {
    name: "home page renders",
    run: async () => {
      const response = await fetchUrl("/");
      assertStatus(response, 200);
      assertIncludes(await response.text(), "RaceDZ", "home page should include RaceDZ");
    }
  },
  {
    name: "races page renders",
    run: async () => {
      const response = await fetchUrl("/races");
      assertStatus(response, 200);
      assertIncludes(await response.text(), "race", "races page should include race copy");
    }
  },
  {
    name: "organizers page renders",
    run: async () => {
      const response = await fetchUrl("/organizers");
      assertStatus(response, 200);
      assertIncludes(await response.text(), "organizer", "organizers page should include organizer copy");
    }
  },
  {
    name: "login page renders",
    run: async () => {
      const response = await fetchUrl("/login");
      assertStatus(response, 200);
      assertIncludes(await response.text(), "Sign in", "login page should include sign in copy");
    }
  },
  {
    name: "register page renders",
    run: async () => {
      const response = await fetchUrl("/register");
      assertStatus(response, 200);
      assertIncludes(await response.text(), "Create", "register page should include create account copy");
    }
  },
  {
    name: "protected account redirects to login",
    run: async () => {
      const response = await fetchUrl("/account", { redirect: "manual" });
      assertRedirect(response, "/login?callbackUrl=/account");
    }
  },
  {
    name: "protected organizer redirects to login",
    run: async () => {
      const response = await fetchUrl("/organizer", { redirect: "manual" });
      assertRedirect(response, "/login?callbackUrl=/organizer");
    }
  },
  {
    name: "protected admin redirects to login",
    run: async () => {
      const response = await fetchUrl("/admin", { redirect: "manual" });
      assertRedirect(response, "/login?callbackUrl=/admin");
    }
  },
  {
    name: "public races API responds with JSON",
    run: async () => {
      const response = await fetchUrl("/api/races");
      assertStatus(response, 200);
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(`expected JSON response, got ${contentType || "no content-type"}`);
      }
    }
  },
  {
    name: "unauthenticated upload API is rejected",
    run: async () => {
      const response = await fetchUrl("/api/uploads", {
        method: "POST"
      });
      assertStatus(response, 401);
    }
  },
  {
    name: "firebase service worker is served",
    run: async () => {
      const response = await fetchUrl("/firebase-messaging-sw.js");
      assertStatus(response, 200);
      assertIncludes(await response.text(), "firebase", "service worker should include firebase setup");
    }
  },
  {
    name: "versioned layout CSS from page preload is served",
    run: async () => {
      const response = await fetchUrl("/");
      assertStatus(response, 200);
      const html = await response.text();
      const cssPath = extractLayoutCssPath(html);

      if (!cssPath) {
        throw new Error("could not find layout.css preload in home page");
      }

      const cssResponse = await fetch(`${baseUrl}${cssPath}`);
      assertStatus(cssResponse, 200);
    }
  }
];

async function main() {
  console.info(`RaceDZ smoke checks against ${baseUrl}`);

  const failures: Array<{ name: string; error: unknown }> = [];

  for (const check of checks) {
    try {
      await check.run();
      console.info(`PASS ${check.name}`);
    } catch (error) {
      failures.push({ name: check.name, error });
      console.error(`FAIL ${check.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (failures.length > 0) {
    console.error(`Smoke checks failed: ${failures.length}/${checks.length}`);
    process.exitCode = 1;
    return;
  }

  console.info(`Smoke checks passed: ${checks.length}/${checks.length}`);
}

function fetchUrl(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, init);
}

function assertStatus(response: Response, expected: number) {
  if (response.status !== expected) {
    throw new Error(`expected status ${expected}, got ${response.status}`);
  }
}

function assertRedirect(response: Response, expectedLocation: string) {
  if (response.status !== 307 && response.status !== 302) {
    throw new Error(`expected redirect status, got ${response.status}`);
  }

  const location = response.headers.get("location");

  if (location !== expectedLocation) {
    throw new Error(`expected redirect to ${expectedLocation}, got ${location ?? "no location"}`);
  }
}

function assertIncludes(value: string, expected: string, message: string) {
  if (!value.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(message);
  }
}

function extractLayoutCssPath(html: string) {
  const match = html.match(/href="(\/_next\/static\/css\/app\/layout\.css\?v=[^"]+)"/);

  return match?.[1] ?? null;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
