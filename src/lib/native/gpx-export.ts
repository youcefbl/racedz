import { Capacitor } from "@capacitor/core";

export type GpxExportDelivery = "download" | "native-share";

function safeFilename(response: Response): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="([^"]+)"/i)?.[1] ?? disposition.match(/filename=([^;]+)/i)?.[1];
  let candidate = "zidrun-run.gpx";
  try {
    candidate = encoded ? decodeURIComponent(encoded) : plain?.trim() || candidate;
  } catch {
    // Keep the safe fallback when a server sends malformed percent encoding.
  }
  const sanitized = candidate.replace(/[^a-zA-Z0-9._-]/g, "-");
  return sanitized.toLowerCase().endsWith(".gpx") ? sanitized : `${sanitized}.gpx`;
}

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error.trim();
  return `${response.status} ${response.statusText}`.trim();
}

/**
 * Fetches an authenticated GPX export and delivers it in a way that works on the
 * current platform. Android WebViews do not reliably honour attachment links, so
 * the native path writes a real cache file and opens Android's save/share sheet.
 */
export async function exportGpx(
  url: string,
  options?: { nativeDialogTitle?: string; onNativeReady?: () => void }
): Promise<GpxExportDelivery> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/gpx+xml, application/json" }
  });
  if (!response.ok) throw new Error(await responseError(response));

  const gpx = await response.text();
  if (!gpx.trim()) throw new Error("The server returned an empty GPX file.");
  const filename = safeFilename(response);

  if (Capacitor.isNativePlatform()) {
    try {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share")
      ]);
      const saved = await Filesystem.writeFile({
        path: `exports/${filename}`,
        data: gpx,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true
      });
      options?.onNativeReady?.();
      await Share.share({
        title: filename,
        files: [saved.uri],
        dialogTitle: options?.nativeDialogTitle
      });
      return "native-share";
    } catch (caught) {
      // The web app is server-hosted and updates instantly; the native shell's plugin set is
      // fixed at APK-build time. A device running an APK built before Filesystem/Share were
      // added gets this exact Capacitor error — surface it as "update the app" rather than the
      // raw plugin string, which means nothing to a runner.
      const message = caught instanceof Error ? caught.message : "";
      if (/not implemented/i.test(message)) {
        const error = new Error(message) as Error & { code?: string };
        error.code = "NATIVE_UNSUPPORTED";
        throw error;
      }
      throw caught;
    }
  }

  const blobUrl = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" }));
  try {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Keep the object URL alive long enough for slower mobile browsers to begin
    // consuming it before releasing the backing Blob.
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  }
  return "download";
}
