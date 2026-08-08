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

HERO = (170, 235, 62)    # bright neon lime, the bold sole edge in the reference
ACCENT = (245, 150, 22)  # warm amber, the foot-shaped backlight in the reference
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

# Amber backlight — FOOT-SHAPED, not a disc. The reference's warm glow hugs the sole and radiates
# from its silhouette, so blur the foot's own alpha rather than a radial source: brightest right at
# the foot edge, fading outward, exactly the shape of the shoe.
foot_sil = (alpha_of("foot.png") > 40).astype(np.float32) * 255
halo = gaussian_filter(foot_sil, sigma=26)
halo = halo / halo.max()
save(np.clip(halo * 255, 0, 255), ACCENT, "zidrun_hold_orange_glow.png")

# Sole base: the reference sole itself — a dark navy interior carrying the teal topographic contour
# lines the source art already draws. Those contours ARE the reference look, so they are kept; only
# the foot's own bright yellow outline is suppressed toward navy, because the bold green edge comes
# from the edge-glow layer and two rims would read as a double edge.
foot = np.asarray(Image.open(os.path.join(SRC, "foot.png")).convert("RGBA")).astype(np.float32)
r, g, b, a = (foot[:, :, i] for i in range(4))
base = foot.copy()
# The outline is the brightest ring in the art; pull just those pixels to navy, leaving the dimmer
# teal interior contours untouched.
lum = (r + g + b) / 3.0
outline = np.clip((lum - 120.0) / 90.0, 0, 1) * (a / 255.0)
NAVY_RIM = np.array([11, 21, 35], np.float32)
for i in range(3):
    base[:, :, i] = foot[:, :, i] * (1 - outline) + NAVY_RIM[i] * outline
# Deepen the interior a touch toward navy so it reads dark like the reference, and let the teal
# contours sit on top of that.
interior = (a / 255.0)
NAVY = np.array([10, 19, 32], np.float32)
for i in range(3):
    base[:, :, i] = base[:, :, i] * (1 - interior * 0.18) + NAVY[i] * (interior * 0.18)
base[:, :, 3] = a
Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGBA").save(
    os.path.join(OUT, "zidrun_hold_sole_base.png"))

# Sole edge glow: the BOLD bright-green rim from the reference. A thick band hugging the silhouette
# (outer blur minus inner blur) plus a tight bright core right on the edge, so it reads as a heavy
# neon outline rather than a faint halo.
sil = (a > 40).astype(np.float32) * 255
band = np.clip(gaussian_filter(sil, sigma=8) - gaussian_filter(sil, sigma=2) * 0.88, 0, 255)
core = np.clip(gaussian_filter(sil, sigma=3.5) - gaussian_filter(sil, sigma=1) * 0.9, 0, 255)
edge = np.clip(band * 2.6 + core * 4.4, 0, 255)
save(edge, HERO, "zidrun_hold_sole_edge_glow.png")

print("regenerated zidrun_hold_* into", os.path.relpath(OUT, HERE))
