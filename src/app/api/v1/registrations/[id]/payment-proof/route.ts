import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, requestId, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { toRegistrationDto } from "@/lib/api/v1/dto";
import { resolvePaymentProofPath, saveImageUpload, UploadError, type ImageUploadFile } from "@/lib/storage";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const MANUAL_METHODS: PaymentMethod[] = ["BARIDIMOB", "CCP", "BANK_TRANSFER", "CASH", "OTHER"];

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

const registrationSelect = {
  id: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  paymentProofUrl: true,
  bibNumber: true,
  createdAt: true,
  raceEvent: {
    select: {
      id: true,
      slug: true,
      title: true,
      startDate: true,
      wilaya: true,
      city: true,
      baridiMobNumber: true,
      ccpAccount: true,
      ccpKey: true,
      paymentNote: true
    }
  },
  raceCategory: { select: { id: true, name: true, distanceKm: true, priceDzd: true } }
} as const;

/**
 * Upload proof of a manual (BaridiMob / CCP / transfer) payment for one of the caller's own
 * registrations. Multipart, one image, handed to the same saveImageUpload() the website uses — so
 * the size cap, magic-byte sniffing, and the sharp re-encode that strips EXIF (including GPS) all
 * apply here too. Setting the proof moves the registration to MANUAL_REVIEW; it never marks it PAID,
 * because only an organizer or admin may do that.
 */
export const POST = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-payment-proof-upload", viewer.id), 15, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many uploads. Try again shortly."));

  const registration = await getPrisma().raceRegistration.findUnique({
    where: { id },
    select: { userId: true, paymentStatus: true }
  });

  // Same 404 for "does not exist" and "belongs to someone else": a different answer would let a
  // caller enumerate other people's registration ids.
  if (!registration || registration.userId !== viewer.id) {
    if (registration) {
      logSecurityEvent("private_file_denied", { userId: viewer.id, registrationId: id, resource: "v1-payment-proof-upload" });
    }
    throw new ApiError("NOT_FOUND", "Registration not found.");
  }
  if (registration.paymentStatus === "NOT_REQUIRED" || registration.paymentStatus === "PAID") {
    throw new ApiError("CONFLICT", "No payment is needed for this registration.");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ApiError("BAD_REQUEST", "Could not read the uploaded file. Try a smaller JPG, PNG, or WebP image.");
  }

  const file = formData.get("file");
  const method = String(formData.get("paymentMethod") ?? "") as PaymentMethod;

  if (!MANUAL_METHODS.includes(method)) {
    throw new ApiError("VALIDATION_FAILED", "Choose how you paid.");
  }
  if (!isUploadedFile(file)) {
    throw new ApiError("VALIDATION_FAILED", "Attach a photo or screenshot of your payment.");
  }

  let storedPath: string;
  try {
    const upload = await saveImageUpload(file as ImageUploadFile, "payment");
    storedPath = upload.url;
  } catch (error) {
    if (error instanceof UploadError) throw new ApiError("VALIDATION_FAILED", error.message);
    throw error;
  }

  const updated = await getPrisma().raceRegistration.update({
    where: { id },
    data: { paymentMethod: method, paymentProofUrl: storedPath, paymentStatus: "MANUAL_REVIEW" },
    select: registrationSelect
  });

  // The DTO exposes hasPaymentProof, never storedPath — the file is only reachable through the
  // authorized GET below.
  return apiOk(request, toRegistrationDto(updated), { status: 201 });
});

/**
 * Read back the caller's own payment proof (financial PII). Owner only: unlike the website's
 * equivalent route this does not serve organizers or admins, because no native screen shows another
 * person's proof and a capability nothing uses is just extra attack surface.
 */
export const GET = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-payment-proof-read", viewer.id), 60, 5 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const registration = await getPrisma().raceRegistration.findUnique({
    where: { id },
    select: { userId: true, paymentProofUrl: true }
  });

  if (!registration || !registration.paymentProofUrl || registration.userId !== viewer.id) {
    if (registration && registration.userId !== viewer.id) {
      logSecurityEvent("private_file_denied", { userId: viewer.id, registrationId: id, resource: "v1-payment-proof" });
    }
    throw new ApiError("NOT_FOUND", "Not found.");
  }

  const filePath = resolvePaymentProofPath(registration.paymentProofUrl);
  if (!filePath) throw new ApiError("NOT_FOUND", "Not found.");

  try {
    const file = await readFile(filePath);
    const extension = filePath.split(".").pop() ?? "";
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Request-Id": requestId(request)
      }
    });
  } catch {
    throw new ApiError("NOT_FOUND", "Not found.");
  }
});

function isUploadedFile(value: FormDataEntryValue | null) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}
