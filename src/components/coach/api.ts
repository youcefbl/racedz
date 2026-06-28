import type { CoachApiError } from "@/components/coach/types";

export async function coachRequest<T>(url: string, init?: RequestInit): Promise<T> {
  // For multipart uploads (audio), let the browser set Content-Type with its boundary.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: isFormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers }
  });
  const payload = (await response.json().catch(() => ({}))) as T & CoachApiError;

  if (!response.ok) {
    const error = new Error(payload.error || "Coach request failed.") as Error & { code?: string; fields?: Record<string, string[]> };
    error.code = payload.code;
    error.fields = payload.fields;
    throw error;
  }

  return payload;
}

