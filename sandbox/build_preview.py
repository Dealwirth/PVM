#!/usr/bin/env python3
"""Baut ``sandbox/preview.html`` (eigenständige Prüf-Sandbox).

Die Vorschau-/Sandbox-Seite muss vollständig in EINER HTML-Datei stehen
(der lokale Preview-Server serviert nur die eine Datei). Dieser Generator
bettet daher die echte ``panel.js`` und den Simulator ``sim.js`` inline ein.

Aufruf (aus dem Projekt-Root)::

    py sandbox/build_preview.py

Ergebnis: ``sandbox/preview.html`` – die Datei ist generiert und wird nicht
eingecheckt (siehe .gitignore). Die Quelle der Wahrheit bleibt immer die
echte ``custom_components/pvm/panel/panel.js``.
"""

from __future__ import annotations

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SANDBOX = os.path.join(ROOT, "sandbox")
PANEL_JS = os.path.join(ROOT, "custom_components", "pvm", "panel", "panel.js")
SIM_JS = os.path.join(SANDBOX, "sim.js")
TEMPLATE = os.path.join(SANDBOX, "index.html")
OUTPUT = os.path.join(SANDBOX, "preview.html")


def main() -> None:
    with open(TEMPLATE, encoding="utf-8") as handle:
        template = handle.read()
    with open(PANEL_JS, encoding="utf-8") as handle:
        panel_js = handle.read()
    with open(SIM_JS, encoding="utf-8") as handle:
        sim_js = handle.read()

    html = template.replace("/*__SIM_JS__*/", sim_js).replace(
        "/*__PVM_PANEL_JS__*/", panel_js
    )

    marker = "<!--__BUILD__-->"
    if marker not in html:
        raise SystemExit("Marker fehlt in sandbox/index.html – Abbruch.")
    build_note = (
        f"{marker}\n<!-- Generiert mit: py sandbox/build_preview.py – "
        f"panel.js {len(panel_js.splitlines())} Zeilen, "
        f"sim.js {len(sim_js.splitlines())} Zeilen -->"
    )
    html = html.replace(marker, build_note)

    with open(OUTPUT, "w", encoding="utf-8") as handle:
        handle.write(html)
    print(f"sandbox/preview.html geschrieben ({len(html.splitlines())} Zeilen)")


if __name__ == "__main__":
    main()
