// Renders a sample RaceDZ email to public/email-preview.html for visual review.
// Run: NEXT_PUBLIC_APP_URL=http://127.0.0.1:3003 npx tsx scripts/email-preview.ts
import { writeFileSync } from "node:fs";
import { renderRaceDzEmailHtml } from "../src/lib/notifications/email-template";

const html = renderRaceDzEmailHtml({
  preheader: "Verify your RaceDZ account to get started",
  title: "Verify your email",
  body: "Welcome to RaceDZ! Confirm your email address to activate your account, then you can register for races and follow your AI coach plan.",
  action: { label: "Verify my email", href: "https://racedz.dz/verify-email/sample-token" },
  meta: [
    { label: "Account", value: "youcef@example.com" },
    { label: "Requested", value: "Today, 14:32" }
  ]
});

writeFileSync("public/email-preview.html", html);
console.log("wrote public/email-preview.html");
