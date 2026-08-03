import { apiOk, withApi, API_VERSION } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/**
 * App compatibility and feature configuration, fetched at launch before the app decides what to
 * render. Public and unauthenticated on purpose: a client that is too old to authenticate still
 * has to be able to learn that it must update.
 *
 * `minimumVersionCode` is the kill switch — an app below it must show a blocking upgrade screen
 * rather than attempt calls whose contract it no longer satisfies.
 */
export const GET = withApi(async (request) =>
  apiOk(request, {
    apiVersion: API_VERSION,
    minimumVersionCode: 1,
    recommendedVersionCode: 1,
    maintenance: false,
    features: {
      // Runs and Coach shipped in the native app, and the shell now genuinely consumes these
      // flags (RUNPAR-006): flipping one to false hides the tab remotely without a new binary —
      // the operator kill switch for a misbehaving feature. Overridable per environment so an
      // incident response is an env change + restart, not a deploy.
      runs: process.env.FEATURE_RUNS !== "false",
      coach: process.env.FEATURE_COACH !== "false",
      registration: true,
      googleSignIn: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
    }
  })
);
