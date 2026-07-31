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
      // Runs and Coach are phase 6; the app hides those tabs until this flips, so a partial
      // rollout does not need a new binary.
      runs: false,
      coach: false,
      registration: true,
      googleSignIn: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
    }
  })
);
