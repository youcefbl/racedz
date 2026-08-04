import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

// Shared response shape for the versioned mobile facade (/api/v1/*). Every route answers with
// either { data, meta } or { error: { code, message, details? } } plus an X-Request-Id header, so
// the Android client can parse one envelope and surface one typed error type instead of guessing
// per endpoint. Codes are stable strings — the app switches on them; messages are human copy and
// may change or be localized without breaking the client.

export const API_VERSION = 1;

/** Stable machine-readable error codes. Add to this union rather than inventing ad-hoc strings. */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "MFA_REQUIRED"
  | "MFA_INVALID"
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_BLOCKED"
  | "SESSION_EXPIRED"
  | "REFRESH_REUSE_DETECTED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_KEY_REUSED"
  // The caller must finish onboarding before this action is possible. Distinct from
  // VALIDATION_FAILED so the app can route to onboarding rather than highlight fields.
  | "PROFILE_INCOMPLETE"
  // Health-data consent is missing or predates the current policy version. Distinct from
  // VALIDATION_FAILED for the same reason as PROFILE_INCOMPLETE: the app must route the runner to
  // re-consent (save their goal), not highlight a field they cannot see.
  | "CONSENT_REQUIRED"
  // The action needs a paid coach subscription. Distinct so the app can offer to subscribe rather
  // than report a failure.
  | "SUBSCRIPTION_REQUIRED"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  // 401 with an MFA_REQUIRED code rather than 200: no session was granted, so treating it as a
  // success would let a client that ignores the body believe the user is signed in.
  MFA_REQUIRED: 401,
  MFA_INVALID: 401,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_BLOCKED: 403,
  SESSION_EXPIRED: 401,
  REFRESH_REUSE_DETECTED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  PROFILE_INCOMPLETE: 428,
  CONSENT_REQUIRED: 403,
  SUBSCRIPTION_REQUIRED: 402,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

/**
 * Correlation ID for one request. Reuses the client's `X-Request-Id` when it looks sane so a
 * report from the app can be matched to a server log line, otherwise mints one. Length-capped and
 * character-restricted because this value ends up in log output.
 */
export function requestId(request: Request): string {
  const provided = request.headers.get("x-request-id");
  if (provided && /^[A-Za-z0-9._-]{8,64}$/.test(provided)) return provided;
  return randomUUID();
}

function withCommonHeaders(response: NextResponse, id: string): NextResponse {
  response.headers.set("X-Request-Id", id);
  response.headers.set("X-Api-Version", String(API_VERSION));
  // Mobile API responses are per-user and often carry PII; never let a proxy or the OS HTTP
  // cache hold on to one.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function apiOk<T>(
  request: Request,
  data: T,
  options?: { meta?: Record<string, unknown>; status?: number; headers?: Record<string, string> }
): NextResponse {
  const id = requestId(request);
  const response = NextResponse.json(
    options?.meta ? { data, meta: options.meta } : { data },
    { status: options?.status ?? 200 }
  );
  for (const [key, value] of Object.entries(options?.headers ?? {})) response.headers.set(key, value);
  return withCommonHeaders(response, id);
}

export function apiError(request: Request, error: ApiError, extraHeaders?: Record<string, string>): NextResponse {
  const id = requestId(request);
  const response = NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    },
    { status: error.status }
  );
  for (const [key, value] of Object.entries(extraHeaders ?? {})) response.headers.set(key, value);
  return withCommonHeaders(response, id);
}

/**
 * Wraps a route handler so every unexpected throw becomes one INTERNAL envelope instead of an
 * HTML error page the app cannot parse, and so the stack lands in the server log with the request
 * ID attached. Never returns the underlying message to the client.
 */
export function withApi<Context>(handler: (request: Request, context: Context) => Promise<NextResponse>) {
  return async (request: Request, context: Context): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return apiError(request, error);
      console.error(`[api/v1][${requestId(request)}]`, error);
      return apiError(request, new ApiError("INTERNAL", "Something went wrong. Please try again."));
    }
  };
}

/** Reads and JSON-parses a bounded request body. Rejects oversized or malformed payloads. */
export async function readJsonBody(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError("BAD_REQUEST", "Request body is too large.");
  }

  const text = await request.text();
  // content-length is client-supplied; check the bytes we actually received too.
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ApiError("BAD_REQUEST", "Request body is too large.");
  }
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("BAD_REQUEST", "Request body is not valid JSON.");
  }
}

/** Pagination shared by every list endpoint. Hard cap so one call cannot pull the whole table. */
export const MAX_PAGE_SIZE = 50;

export function parsePageParams(url: URL): { page: number; limit: number; skip: number } {
  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE) : 20;
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasMore: page < totalPages };
}
