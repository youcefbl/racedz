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

  const extension = imageExtensionsByMimeType.get(file.type);

  if (!extension) {
    throw new UploadError("Upload a JPG, PNG, WebP, or GIF image.");
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const directory = path.join(process.cwd(), "public", "uploads", scope, month);
  const filename = `${randomUUID()}.${extension}`;
  const absolutePath = path.join(directory, filename);
  const publicUrl = `/uploads/${scope}/${month}/${filename}`;

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    url: publicUrl,
    size: file.size,
    contentType: file.type
  };
}
