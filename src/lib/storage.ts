import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const uploadScopes = ["avatar", "race", "organization", "payment"] as const;

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

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const directory = path.join(process.cwd(), "public", "uploads", scope, month);
  const filename = `${randomUUID()}.${detected.extension}`;
  const absolutePath = path.join(directory, filename);
  const publicUrl = `/uploads/${scope}/${month}/${filename}`;

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, bytes);

  return {
    url: publicUrl,
    size: file.size,
    contentType: detected.mimeType
  };
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
