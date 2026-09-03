"""Stub für Home-Assistant-Module in reinen Unit-Tests.

Die Logik-Tests importieren nur reines Python (engine, wp_test, detector,
config_model, panel_data). Da aber ``custom_components/pvm/__init__``
beim Paket-Import Home-Assistant-Module lädt, werden hier harmlose Platzhalter
in ``sys.modules`` registriert. Für den Import-Smoke-Test der HA-seitigen
Module gibt es zusätzlich echte Basisklassen. Die echte Integration läuft
unverändert in HA.
"""

from __future__ import annotations

import sys
import types

_NEEDED = [
    "voluptuous",
    "homeassistant",
    "homeassistant.const",
    "homeassistant.core",
    "homeassistant.config_entries",
    "homeassistant.components",
    "homeassistant.components.sensor",
    "homeassistant.components.number",
    "homeassistant.components.switch",
    "homeassistant.components.button",
    "homeassistant.components.select",
    "homeassistant.components.time",
    "homeassistant.components.lovelace",
    "homeassistant.components.lovelace.dashboard",
    "homeassistant.components.lovelace.const",
    "homeassistant.components.frontend",
    "homeassistant.components.websocket_api",
    "homeassistant.components.http",
    "homeassistant.util",
    "homeassistant.util.dt",
    "homeassistant.helpers",
    "homeassistant.helpers.device_registry",
    "homeassistant.helpers.entity_registry",
    "homeassistant.helpers.entity_platform",
    "homeassistant.helpers.storage",
    "homeassistant.helpers.selector",
    "homeassistant.setup",
]


def _plain_class(name: str, **attrs):
    """Erzeugt eine leere, subklassierbare Klasse mit optionalen Klassen-Attributen."""
    attrs.setdefault("__init_subclass__", lambda cls, **kwargs: None)
    return type(name, (), attrs)


def _install_stubs() -> None:
    for name in _NEEDED:
        if name in sys.modules:
            continue
        module = types.ModuleType(name)
        module.__path__ = []  # Als Paket markieren

        def _attr_getter(_name: str, _module_name: str = name):
            # Submodule (z. B. homeassistant.config_entries) korrekt auflösen,
            # alle anderen fehlenden Namen als Platzhalter liefern.
            child = sys.modules.get(f"{_module_name}.{_name}")
            if child is not None:
                return child
            return object()

        module.__getattr__ = _attr_getter
        sys.modules[name] = module

    # voluptuous: aufrufbare Bausteine (Schema-Semantik wird nicht gebraucht)
    vol = sys.modules["voluptuous"]
    vol.Required = lambda value: value
    vol.Optional = lambda value, **kwargs: value
    vol.Schema = lambda value: value
    vol.All = lambda *args, **kwargs: (args[0] if args else None)
    vol.In = lambda *args, **kwargs: (args[0] if args else None)
    vol.Any = lambda *args, **kwargs: (args[0] if args else None)
    vol.Coerce = lambda func: func
    vol.Range = lambda *args, **kwargs: None
    vol.Length = lambda *args, **kwargs: None
    vol.Match = lambda *args, **kwargs: None
    vol.Number = float
    vol.UNDEFINED = object()

    const = sys.modules["homeassistant.const"]
    for key, value in {
        "STATE_ON": "on",
        "STATE_OFF": "off",
        "STATE_UNKNOWN": "unknown",
        "STATE_UNAVAILABLE": "unavailable",
        "EVENT_HOMEASSISTANT_STARTED": "homeassistant_started",
    }.items():
        setattr(const, key, value)

    # Echte Basisklassen (damit die Plattform-Module importierbar sind)
    base_defs = {
        "homeassistant.components.sensor": {
            "SensorEntity": _plain_class("SensorEntity"),
            "SensorDeviceClass": _plain_class(
                "SensorDeviceClass",
                POWER="power",
                ENERGY="energy",
                TEMPERATURE="temperature",
                BATTERY="battery",
            ),
            "SensorStateClass": _plain_class(
                "SensorStateClass", MEASUREMENT="measurement", TOTAL="total"
            ),
        },
        "homeassistant.components.number": {
            "NumberEntity": _plain_class("NumberEntity"),
            "NumberMode": _plain_class(
                "NumberMode", SLIDER="slider", BOX="box", AUTO="auto"
            ),
        },
        "homeassistant.components.switch": {"SwitchEntity": _plain_class("SwitchEntity")},
        "homeassistant.components.button": {"ButtonEntity": _plain_class("ButtonEntity")},
        "homeassistant.components.select": {"SelectEntity": _plain_class("SelectEntity")},
        "homeassistant.components.time": {"TimeEntity": _plain_class("TimeEntity")},
        "homeassistant.config_entries": {
            "ConfigEntry": _plain_class("ConfigEntry"),
            "ConfigFlow": _plain_class("ConfigFlow"),
            "OptionsFlow": _plain_class("OptionsFlow"),
        },
        "homeassistant.helpers.storage": {
            "Store": _plain_class("Store", __class_getitem__=classmethod(lambda cls, _t: cls))
        },
        "homeassistant.core": {
            "HomeAssistant": _plain_class("HomeAssistant"),
            "callback": lambda func: func,
        },
        "homeassistant.helpers.selector": {
            name: _plain_class(name)
            for name in (
                "BooleanSelector",
                "EntitySelector",
                "EntitySelectorConfig",
                "NumberSelector",
                "NumberSelectorConfig",
                "NumberSelectorMode",
                "SelectSelector",
                "SelectSelectorConfig",
                "TextSelector",
                "TimeSelector",
            )
        },
    }
    for module_name, definitions in base_defs.items():
        module = sys.modules[module_name]
        known = dict(definitions)
        module.__dict__.update(definitions)

        def _getter(_name: str, _known=known):
            return _known.get(_name, object())

        module.__getattr__ = _getter

    # WebSocket-API: funktionierende Decorator (ignorieren Schema/Handler)
    ws = sys.modules["homeassistant.components.websocket_api"]
    ws.websocket_command = lambda *_a, **_k: (lambda func: func)
    ws.async_response = lambda func: func
    ws.async_register_command = lambda *_a, **_k: None
    ws.ActiveConnection = _plain_class("ActiveConnection")
    ws.result_message = lambda _id, result: result
    ws.error_message = lambda _id, _code, _msg: {}

    # HTTP-Komponente: StaticPathConfig für Panel-/Asset-Registrierung
    http = sys.modules["homeassistant.components.http"]
    http.StaticPathConfig = _plain_class("StaticPathConfig")


_install_stubs()
