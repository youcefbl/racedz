import * as Sentry from "@sentry/nextjs";
import { beforeSend, beforeSendTransaction } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // SEC-013: strip cookies/auth headers and redact sensitive request/context fields before upload.
  beforeSend,
  beforeSendTransaction
});
