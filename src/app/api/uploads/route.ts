import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { isUploadScope, saveImageUpload, UploadError, type ImageUploadFile, type UploadScope } from "@/lib/storage";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  // Throttle per user so a single account can't loop 5 MB uploads to exhaust disk.
  const limited = enforceRateLimit(rateLimitKey("upload", session.user.id), 30, 10 * 60_000);
  if (limited) return limited;

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read uploaded file. Try a smaller JPG, PNG, WebP, or GIF image." }, { status: 400 });
  }
  const file = formData.get("file");
  const scopeValue = formData.get("scope");

  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }

  if (!isUploadScope(scopeValue)) {
    return NextResponse.json({ error: "Invalid upload scope" }, { status: 400 });
  }

  if (!canUploadToScope(session.user.role, scopeValue)) {
    return NextResponse.json({ error: "You do not have access to this upload scope" }, { status: 403 });
  }

  try {
    const upload = await saveImageUpload(file as ImageUploadFile, scopeValue);

    return NextResponse.json({ data: upload }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

function isUploadedFile(value: FormDataEntryValue | null) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number" &&
    typeof (value as Blob).type === "string"
  );
}

function canUploadToScope(role: string | undefined, scope: UploadScope) {
  // Avatars and payment proofs are uploaded by ordinary runners; race/org images by staff.
  if (scope === "avatar" || scope === "payment") {
    return true;
  }

  return role === "ORGANIZER" || role === "ADMIN" || role === "SUPERADMIN";
}
