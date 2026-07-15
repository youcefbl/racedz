import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

export const uploadScopes = ["avatar", "race", "organization", "payment", "run", "coach-payment"] as const;

export type UploadScope = (typeof uploadScopes)[number];

const maxImageBytes = 5 * 1024 * 1024;

const imageExtensionsByMimeType = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export function isUploadScope(value: unknown): value is UploadScope {
  return typeof value === "string" && uploadScopes.includes(value as UploadScope);
}

export type ImageUploadFile = {
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export async function saveImageUpload(file: ImageUploadFile, scope: UploadScope) {
  if (process.env.UPLOAD_STORAGE_DRIVER && process.env.UPLOAD_STORAGE_DRIVER !== "local") {
    throw new UploadError("Only local upload storage is configured for this environment.", 500);
  }

  if (file.size <= 0) {
    throw new UploadError("Choose an image file to upload.");
  }

  if (file.size > maxImageBytes) {
    throw new UploadError("Image must be 5 MB or smaller.");
  }

  if (!imageExtensionsByMimeType.has(file.type)) {
    throw new UploadError("Upload a JPG, PNG, WebP, or GIF image.");
  }

  // Don't trust the client-supplied Content-Type: sniff the real format from the file's
  // magic bytes. This rejects spoofed/polyglot files (e.g. HTML disguised as image/png)
  // before they land in the publicly served uploads directory. The stored extension and
  // the reported content type are both derived from the detected type, never the declared one.
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(bytes);

  if (!detected) {
    throw new UploadError("That file is not a valid JPG, PNG, WebP, or GIF image.");
  }

  // Re-encode the pixels through sharp before storing. This is the last upload-hardening layer:
  // decoding then re-encoding (a) strips all metadata — EXIF GPS coordinates, camera info, and any
  // embedded thumbnail/ICC payloads that could carry an exploit — and (b) collapses malformed or
  // polyglot files that survived the magic-byte check, since the output is written by our encoder,
  // not copied from the untrusted input. The stored format matches the detected format.
  const safeBytes = await reencodeImage(bytes, detected);

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const directory = path.join(process.cwd(), "public", "uploads", scope, month);
  const filename = `${randomUUID()}.${detected.extension}`;
  const absolutePath = path.join(directory, filename);

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, safeBytes);

  return {
    // Payment proofs are financial PII: they live in the same volume but are never served by the
    // public /uploads/* handler (Caddy 403s that path). Their URL is an authenticated app route
    // that only the owner or an admin can read. Every other scope keeps the fast static URL.
    url:
      scope === "coach-payment"
        ? `/api/coach/subscription/proof/${month}/${filename}`
        : `/uploads/${scope}/${month}/${filename}`,
    size: safeBytes.length,
    contentType: detected.mimeType
  };
}

// Decode and re-encode an already-magic-byte-validated image to the same format, dropping all
// metadata. sharp strips metadata by default (we never call withMetadata); .rotate() bakes in EXIF
// orientation before it's discarded so JPEG/WebP photos keep the right side up. Animated GIFs are
// re-encoded frame-by-frame. A decode failure means the "image" wasn't really decodable → reject it.
async function reencodeImage(bytes: Buffer, detected: { mimeType: string; extension: string }): Promise<Buffer> {
  try {
    switch (detected.mimeType) {
      case "image/jpeg":
        return await sharp(bytes).rotate().jpeg({ quality: 85 }).toBuffer();
      case "image/png":
        return await sharp(bytes).png({ compressionLevel: 9 }).toBuffer();
      case "image/webp":
        return await sharp(bytes).rotate().webp({ quality: 85 }).toBuffer();
      case "image/gif":
        return await sharp(bytes, { animated: true }).gif().toBuffer();
      default:
        throw new UploadError("Unsupported image format.");
    }
  } catch (error) {
    if (error instanceof UploadError) {
      throw error;
    }
    throw new UploadError("That image could not be processed. Try a different file.");
  }
}

// Resolve a coach-payment proof URL (/api/coach/subscription/proof/<month>/<file>) back to its file
// on disk, or null if the URL is malformed. Used by the authenticated serving route and by cleanup.
export function resolveCoachPaymentProofPath(proofUrl: string): string | null {
  const match = /^\/api\/coach\/subscription\/proof\/(\d{4}-\d{2})\/([a-f0-9-]+\.(?:jpg|png|webp|gif))$/.exec(proofUrl);
  if (!match) return null;
  return path.join(process.cwd(), "public", "uploads", "coach-payment", match[1], match[2]);
}

// Identify an image strictly by its magic bytes (file signature). Returns null for
// anything that isn't one of the four allowed raster formats.
function detectImageType(bytes: Buffer): { mimeType: string; extension: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (bytes.length >= 6 && bytes.toString("ascii", 0, 6) === "GIF87a") {
    return { mimeType: "image/gif", extension: "gif" };
  }
  if (bytes.length >= 6 && bytes.toString("ascii", 0, 6) === "GIF89a") {
    return { mimeType: "image/gif", extension: "gif" };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}
