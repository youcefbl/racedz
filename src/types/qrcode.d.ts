// Minimal ambient types for the `qrcode` package (only the surface we use). @types/qrcode isn't
// installed to keep the dependency footprint small; extend this if we start using more of the API.
declare module "qrcode" {
  interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  const _default: { toDataURL: typeof toDataURL };
  export default _default;
}
