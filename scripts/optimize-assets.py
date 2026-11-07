"""
Phase 6.2 — PWA/asset weight optimization.

Problem measured before this change:
  public/favicon.png   1229x1280  1488 KB
  public/logo-main.png 2172x724   1124 KB
  public/mascotte.png  1024x1536  2435 KB
  -> vite-plugin-pwa precached all three: 4.2 MB precache on first load.

Targets: a favicon/icon/logo are displayed at <= 512px, so anything larger is pure
waste. Originals are preserved alongside the optimized versions.
"""

import os
from PIL import Image

JOBS = [
    # (src, dst, box, note)
    ("public/favicon.png", "public/favicon.png", 192, "browser tab icon"),
    ("public/logo-main.png", "public/logo-main.png", 512, "PWA icon + nav logo"),
    ("public/mascotte.png", "public/mascotte.png", 512, "PWA icon + marketing"),
]

for src, dst, box, note in JOBS:
    im = Image.open(src)
    if im.mode not in ("RGBA", "RGB", "P"):
        im = im.convert("RGBA")
    if im.mode == "P":
        im = im.convert("RGBA")

    # Downscale preserving aspect ratio (never upscale).
    w, h = im.size
    scale = min(1.0, box / max(w, h))
    if scale < 1.0:
        new_size = (max(1, round(w * scale)), max(1, round(h * scale)))
        im = im.resize(new_size, Image.LANCZOS)

    im.save(dst, "PNG", optimize=True)
    print(f"{dst:28} {str(im.size):14} {note:22} {os.path.getsize(dst)/1024:8.1f} KB")

print("\ndone")
