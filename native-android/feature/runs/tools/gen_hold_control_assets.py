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


# A footprint's heel sits a few degrees clockwise of top in the source ring; rotating the art by
# +6 deg brings that heel to 12 o'clock so the clockwise reveal begins at a footprint's start
# (its heel) rather than on a track dash or mid-footprint.
ORBIT_ROTATE_DEG = 6

def alpha_of(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGBA"))[:, :, 3].astype(np.float32)

def rotated_alpha(name):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA").rotate(
        ORBIT_ROTATE_DEG, resample=Image.BICUBIC, center=None)
    return np.asarray(im)[:, :, 3].astype(np.float32)


def save(alpha, rgb, name):
    out = np.zeros((*alpha.shape, 4), np.uint8)
    for i, c in enumerate(rgb):
        out[:, :, i] = c
    out[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(os.path.join(OUT, name))


# Active orbit: bold filled lime footprints + a soft lime bloom, from the active-ring coverage.
cov = rotated_alpha("orbit_ring_active.png")
if cov.max() < 40:
    cov = rotated_alpha("orbit_ring.png")
save(np.clip(grey_dilation(cov, size=5) * 1.3 + gaussian_filter(cov, sigma=7) * 1.5, 0, 255),
     HERO, "zidrun_hold_orbit_active.png")

# Inactive orbit: identical geometry, muted blue-grey, dimmer than the active layer.
cov = rotated_alpha("orbit_ring.png")
save(np.clip(grey_dilation(cov, size=3) * 0.9, 0, 190), MUTED, "zidrun_hold_orbit_inactive.png")

# Orange backlight: warm, soft, clean alpha, no pale/white core (gamma pulls the centre down).
lum = gaussian_filter(alpha_of("orange_glow.png"), sigma=22)  # lamp-shadow: very soft
lum = lum / lum.max()
save(np.clip((lum ** 1.15) * 255, 0, 255), ACCENT, "zidrun_hold_orange_glow.png")

# Sole base: the foot as-is, but its baked yellow rim recoloured to lime. "warmth" isolates the
# warm rim/glow (high G, low B) from the cyan interior contours, and only those pixels shift.
foot = np.asarray(Image.open(os.path.join(SRC, "foot.png")).convert("RGBA")).astype(np.float32)
r, g, b, a = (foot[:, :, i] for i in range(4))
warmth = np.clip((np.clip(np.minimum(r, g) - b, 0, 255) / 255.0) * 1.4, 0, 1) * (a / 255.0)
base = foot.copy()
NAVY_RIM = np.array([12, 22, 36], np.float32)
for i in range(3):
    # suppress the foot's own bright rim toward navy — the edge-glow layer is the single lit edge
    base[:, :, i] = foot[:, :, i] * (1 - warmth) + NAVY_RIM[i] * warmth
# Premium sole: deepen the interior toward a rich navy, and lift the cyan contour lines so they
# read as crisp topographic tread rather than a murky wash. "coolness" isolates the cyan interior.
coolness = np.clip((np.clip(b - g, 0, 255) / 255.0) * 2.0, 0, 1) * (a / 255.0) * (1 - warmth)
interior = (1 - warmth) * (a / 255.0)
NAVY = np.array([10, 20, 34], np.float32)
CYAN = np.array([120, 200, 210], np.float32)
for i in range(3):
    base[:, :, i] = base[:, :, i] * (1 - interior * 0.35) + NAVY[i] * (interior * 0.35)
    base[:, :, i] = base[:, :, i] * (1 - coolness * 0.5) + CYAN[i] * (coolness * 0.5)
Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGBA").save(
    os.path.join(OUT, "zidrun_hold_sole_base.png"))

# Sole edge glow: a bright lime rim hugging the foot silhouette (outer blur minus inner blur).
sil = (a > 40).astype(np.float32) * 255
rim = np.clip(gaussian_filter(sil, sigma=6) - gaussian_filter(sil, sigma=2) * 0.95, 0, 255) * 3.4
save(rim, HERO, "zidrun_hold_sole_edge_glow.png")

print("regenerated zidrun_hold_* into", os.path.relpath(OUT, HERE))
