"""Stub für Home-Assistant-Module in reinen Unit-Tests.

Die Logik-Tests importieren nur reines Python (engine, wp_test, detector,
config_model, dashboard_builder). Da aber ``custom_components/pvm/__init__``
beim Paket-Import Home-Assistant-Module lädt, werden hier harmlose Platzhalter
in ``sys.modules`` registriert. Die echte Integration läuft unverändert in HA.
"""

from __future__ import annotations

import sys
import types

# Alle Module, die beim Import der PVM-Pakete benötigt werden (Top-Level-Imports).
_NEEDED = [
    "homeassistant",
    "homeassistant.const",
    "homeassistant.core",
    "homeassistant.config_entries",
    "homeassistant.util",
    "homeassistant.util.dt",
    "homeassistant.helpers",
    "homeassistant.helpers.entity_registry",
    "homeassistant.helpers.storage",
    "homeassistant.helpers.selector",
    "homeassistant.setup",
]


def _install_stubs() -> None:
    for name in _NEEDED:
        if name in sys.modules:
            continue
        module = types.ModuleType(name)
        module.__path__ = []  # Als Paket markieren

        def _attr_getter(_name: str):
            # Beliebige Importe (Klassen, Funktionen) mit Platzhaltern füllen.
            return object()

        module.__getattr__ = _attr_getter
        sys.modules[name] = module

    # Konstanten, die beim Import tatsächlich gelesen werden
    const = sys.modules["homeassistant.const"]
    for key, value in {
        "STATE_ON": "on",
        "STATE_OFF": "off",
        "STATE_UNKNOWN": "unknown",
        "STATE_UNAVAILABLE": "unavailable",
        "EVENT_HOMEASSISTANT_STARTED": "homeassistant_started",
    }.items():
        setattr(const, key, value)


_install_stubs()
