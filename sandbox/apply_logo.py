# -*- coding: utf-8 -*-
"""Übernimmt das neue PVM-Logo (vom Nutzer geliefert) in alle Größen.

Liest das 1254×1254-RGBA-PNG ein, decodiert die PNG-Filter, skaliert
bilinear auf 256 px (icon.png) und 512 px (logo.png) und schreibt
optimierte PNGs zurück ins Projekt (nur Standardbibliothek).
"""
from __future__ import annotations

import os
import struct
import zlib

SOURCE = r"C:\Users\Max Petry\Downloads\logo ha\ChatGPT Image 5. Sept. 2026, 12_26_17 (1).png"


def _read_png_rgba(path: str) -> tuple[int, int, list]:
    """Dekodiert ein RGBA-PNG (8 Bit) in eine Pixel-Liste [r,g,b,a]*w*h."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Kein PNG")
    pos = 8
    idat = b""
    w = h = 0
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        if ctype == b"IHDR":
            w, h = struct.unpack(">II", chunk[:8])
        elif ctype == b"IDAT":
            idat += chunk
        pos += 12 + length
    raw = zlib.decompress(idat)
    stride = w * 4
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    pos = 0
    for y in range(h):
        ftype = raw[pos]
        row = bytearray(raw[pos + 1:pos + 1 + stride])
        pos += 1 + stride
        # PNG-Filter rückwärts aufheben
        if ftype == 1:  # Sub
            for i in range(4, stride):
                row[i] = (row[i] + row[i - 4]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                left = row[i - 4] if i >= 4 else 0
                row[i] = (row[i] + (left + prev[i]) // 2) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                a = row[i - 4] if i >= 4 else 0
                b = prev[i]
                c = prev[i - 4] if i >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                if pa <= pb and pa <= pc:
                    pred = a
                elif pb <= pc:
                    pred = b
                else:
                    pred = c
                row[i] = (row[i] + pred) & 0xFF
        prev = row
        out[y * stride:(y + 1) * stride] = row
    return w, h, out


def _scale_bilinear(w: int, h: int, px: bytearray, nw: int, nh: int) -> bytearray:
    out = bytearray(nw * nh * 4)
    for y in range(nh):
        sy = (y + 0.5) * h / nh - 0.5
        y0 = max(0, min(h - 1, int(sy)))
        y1 = min(h - 1, y0 + 1)
        fy = sy - y0
        for x in range(nw):
            sx = (x + 0.5) * w / nw - 0.5
            x0 = max(0, min(w - 1, int(sx)))
            x1 = min(w - 1, x0 + 1)
            fx = sx - x0
            for c in range(4):
                p00 = px[(y0 * w + x0) * 4 + c]
                p01 = px[(y0 * w + x1) * 4 + c]
                p10 = px[(y1 * w + x0) * 4 + c]
                p11 = px[(y1 * w + x1) * 4 + c]
                out[(y * nw + x) * 4 + c] = round(
                    p00 * (1 - fx) * (1 - fy) + p01 * fx * (1 - fy)
                    + p10 * (1 - fx) * fy + p11 * fx * fy
                )
    return out


def write_png(path: str, w: int, h: int, rgba: bytearray) -> None:
    def chunk(ctype: bytes, payload: bytes) -> bytes:
        return (struct.pack(">I", len(payload)) + ctype + payload
                + struct.pack(">I", zlib.crc32(ctype + payload) & 0xFFFFFFFF))

    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # Filter: None
        raw += rgba[y * stride:(y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    w, h, px = _read_png_rgba(SOURCE)
    for name, size in (("icon.png", 256), ("logo.png", 512)):
        scaled = _scale_bilinear(w, h, px, size, size)
        write_png(os.path.join(root, name), size, size, scaled)
        print(f"{name} geschrieben ({size} px)")


if __name__ == "__main__":
    main()
