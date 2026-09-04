# -*- coding: utf-8 -*-
"""Erzeugt das PVM-Logo als PNG (nur Standardbibliothek).

Design: blaue, abgerundete Fläche mit Sonnenring (oben links) und
Blitz (unten rechts) in Weiss – „Solarstrom intelligent verteilen“.
Ausgabe: ../icon.png (256 px) und ../logo.png (512 px), Basis für die
Seitenleiste, den README-Kopf und die HACS-Darstellung.
"""
from __future__ import annotations

import os
import struct
import zlib

_S = 0.5  # 2x Supersampling


def _lerp(a, b, t):
    return a + (b - a) * t


def _bg(t):
    """Vertikaler Blau-Verlauf: oben hell, unten tief."""
    top = (38, 139, 255)
    bot = (10, 79, 158)
    return tuple(round(_lerp(top[i], bot[i], t)) for i in range(3))


def _in_round_rect(x, y, w, h, r):
    cx = min(max(x, r), w - r)
    cy = min(max(y, r), h - r)
    dx = x - cx
    dy = y - cy
    return dx * dx + dy * dy <= r * r


def _in_poly(x, y, pts):
    inside = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xat = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < xat:
                inside = not inside
    return inside


# Blitz (Klassische Form, Anteile 0..1)
BOLT = [
    (0.585, 0.185), (0.360, 0.580), (0.520, 0.580),
    (0.450, 0.860), (0.705, 0.495), (0.530, 0.495),
]
SUN_CX, SUN_CY = 0.315, 0.335
SUN_RO = 0.150
SUN_RI = 0.088
CORNER = 0.205


def _sample(x, y, w, h):
    """Farbe (r,g,b,a) an Supersample-Punkt."""
    if not _in_round_rect(x, y, w, h, CORNER * w):
        return (0, 0, 0, 0)
    # Sonnenring
    d2 = (x - SUN_CX * w) ** 2 + (y - SUN_CY * w) ** 2
    if (SUN_RI * w) ** 2 <= d2 <= (SUN_RO * w) ** 2:
        return (255, 255, 255, 255)
    if _in_poly(x, y, [(px * w, py * w) for px, py in BOLT]):
        return (255, 255, 255, 255)
    t = y / h
    r, g, b = _bg(t)
    return (r, g, b, 255)


def render(size: int) -> bytes:
    big = size * 2
    grid = []
    for by in range(big):
        row = []
        y0 = (by + 0.5) / 2
        for bx in range(big):
            x0 = (bx + 0.5) / 2
            row.append(_sample(x0, y0, size, size))
        grid.append(row)
    # Downsample 2x2
    px = bytearray()
    for y in range(size):
        px.append(0)  # Filter-Typ 0
        for x in range(size):
            rs = gs = bs = asum = 0
            for dy in (0, 1):
                for dx in (0, 1):
                    r, g, b, a = grid[y * 2 + dy][x * 2 + dx]
                    rs += r * a
                    gs += g * a
                    bs += b * a
                    asum += a
            if asum:
                px += bytes((rs // asum, gs // asum, bs // asum, asum // 4))
            else:
                px += bytes((0, 0, 0, 0))
    return _png(size, size, bytes(px))


def _png(w: int, h: int, raw: bytes) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name, size in (("icon.png", 256), ("logo.png", 512)):
        path = os.path.join(root, name)
        with open(path, "wb") as fh:
            fh.write(render(size))
        print("{} geschrieben ({} px)".format(name, size))


if __name__ == "__main__":
    main()
