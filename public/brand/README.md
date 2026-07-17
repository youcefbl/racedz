# ZidRun Brand Assets

This folder is the canonical public home for ZidRun logo and mark exports.

## Files

- `zidrun-logo.svg` — primary full-color wordmark for light backgrounds.
- `zidrun-logo-dark.svg` — full wordmark for dark backgrounds.
- `zidrun-logo-race.svg` — high-energy race-mode wordmark.
- `zidrun-logo.png` — raster fallback for tools that cannot use SVG.
- `zidrun-mark.svg` — standalone Z mark for avatars and compact placements.
- `zidrun-mark-race.svg` — race-mode standalone Z mark.
- `zidrun-mark.png` — raster mark fallback for social/tool uploads.

## What Stays Outside This Folder

- Root-level `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/maskable-512.png`, and `public/apple-icon.png` are generated PWA/app icons used by `src/app/manifest.ts` and platform metadata.
- `public/app/` stores app screenshots and product UI captures.
- `public/blog/` stores blog imagery.
- `public/uploads/` stores runtime user uploads and should not be used for brand source files.

Use `src/components/layout/racedz-logo.tsx` for in-app rendering. It reads inline vector artwork from `src/components/layout/zidrun-logo-svg.ts` so the logo can adapt to light, dark, and race themes.
