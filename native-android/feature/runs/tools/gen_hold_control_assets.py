#!/usr/bin/env python3
"""Regenerate the press-and-hold Start-Run control artwork.

The reference is docs/run-startpng.png. That render is only 386x404 and has the "Hold / to begin"
text and (in the design frames) the stage labels baked in, so it is not usable as a source for
crisp phone artwork. The original exported ZidRun run layers, however, already carry the exact
geometry the reference wants — the foot silhouette with its contour lines, and the footprint-and-
dash orbit — they are simply the wrong colour (a yellow-green outline rather than the reference's
neon lime) and the orange glow has a pale core.

So this script does a deterministic recolour of those high-res source exports (in
tools/hold-control-source/) to the reference palette, producing the aligned RGBA layers the
control stacks. No generative redraw, no masking of the low-res composite — every output keeps the
source geometry pixel for pixel and only its colour and coverage change.

Run from this directory:  python3 gen_hold_control_assets.py
Outputs overwrite:        ../src/main/res/drawable-nodpi/zidrun_hold_*.png

Palette (ZidRun tokens, must not drift):
  heroAccent #A3E635  active lime        accent #FB923C  warm orange
"""
import os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, grey_dilation

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "hold-control-source")
OUT = os.path.join(HERE, "..", "src", "main", "res", "drawable-nodpi")

HERO = (163, 230, 53)    # #A3E635
ACCENT = (251, 146, 60)  # #FB923C
MUTED = (120, 132, 150)  # muted blue-grey orbit


def alpha_of(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGBA"))[:, :, 3].astype(np.float32)


def save(alpha, rgb, name):
    out = np.zeros((*alpha.shape, 4), np.uint8)
    for i, c in enumerate(rgb):
        out[:, :, i] = c
    out[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(os.path.join(OUT, name))


# Active orbit: bold filled lime footprints + a soft lime bloom, from the active-ring coverage.
cov = alpha_of("orbit_ring_active.png")
if cov.max() < 40:
    cov = alpha_of("orbit_ring.png")
save(np.clip(grey_dilation(cov, size=5) * 1.3 + gaussian_filter(cov, sigma=7) * 1.5, 0, 255),
     HERO, "zidrun_hold_orbit_active.png")

# Inactive orbit: identical geometry, muted blue-grey, dimmer than the active layer.
cov = alpha_of("orbit_ring.png")
save(np.clip(grey_dilation(cov, size=3) * 0.9, 0, 190), MUTED, "zidrun_hold_orbit_inactive.png")

# Orange backlight: warm, soft, clean alpha, no pale/white core (gamma pulls the centre down).
lum = gaussian_filter(alpha_of("orange_glow.png"), sigma=5)
lum = lum / lum.max()
save(np.clip((lum ** 1.3) * 255, 0, 235), ACCENT, "zidrun_hold_orange_glow.png")

# Sole edge glow: a crisp lime rim hugging the foot silhouette (outer blur minus inner blur).
sil = (alpha_of("foot.png") > 40).astype(np.float32) * 255
rim = np.clip(gaussian_filter(sil, sigma=6) - gaussian_filter(sil, sigma=2) * 0.92, 0, 255) * 2.6
save(rim, HERO, "zidrun_hold_sole_edge_glow.png")

print("regenerated zidrun_hold_* into", os.path.relpath(OUT, HERE))
