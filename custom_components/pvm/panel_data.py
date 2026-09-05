"""Daten für das eigene PVM-Panel (Seitenleisten-Seite).

Stellt dem Panel die aktuelle Konfiguration, das Entitäten-Mapping und die
Erkennungs-Vorschläge bereit. Bewusst weitgehend „pur“ gehalten (Registry
wird als Parameter durchgereicht), damit die Funktionen ohne echte
Home-Assistant-Instanz testbar sind.
"""

from __future__ import annotations

from typing import Any

from .const import DOMAIN, VERSION

# Globale Entitäten: Schlüssel → unique_id
GLOBAL_IDS = {
    "surplus": "pvm_surplus",
    "engine_status": "pvm_status",
    "setup": "pvm_setup",
    "reserve": "pvm_reserve",
    "cycle": "pvm_cycle",
    "min_on": "pvm_min_on",
    "min_off": "pvm_min_off",
    "mode": "pvm_mode",
    "theme": "pvm_theme",
    "scan": "pvm_scan",
    "rebuild": "pvm_rebuild",
}

# Geräte-Entitäten: Schlüssel → unique_id-Präfix
DEVICE_PREFIXES = {
    "rank": "pvm_rank",
    "status": "pvm_status",
    "up": "pvm_prio_up",
    "down": "pvm_prio_down",
    "auto": "pvm_auto",
    "power_charge": "pvm_power_charge",
    "grid_min": "pvm_grid_min",
    "grid_deadline": "pvm_grid_deadline",
    "grid_fallback": "pvm_grid_fallback",
    "comfort": "pvm_comfort",
    "safety": "pvm_safety",
    "nominal": "pvm_nominal",
    "power_limit": "pvm_power_limit",
    "min_on_power": "pvm_min_on_power",
    "min_soc": "pvm_min_soc",
    "max_soc": "pvm_max_soc",
    "deadline_soc": "pvm_deadline_soc",
    "deadline_time": "pvm_deadline_time",
    "car_status": "pvm_car_status",
}


def _platform_of(kind: str) -> str:
    """Plattform einer Entitäten-Art (Spiegel der Platform-Module)."""
    return {
        "surplus": "sensor",
        "engine_status": "sensor",
        "setup": "sensor",
        "scan": "button",
        "rebuild": "button",
        "mode": "select",
        "theme": "select",
        "reserve": "number",
        "cycle": "number",
        "min_on": "number",
        "min_off": "number",
        "rank": "sensor",
        "status": "sensor",
        "up": "button",
        "down": "button",
        "auto": "switch",
        "power_charge": "switch",
        "grid_min": "switch",
        "grid_deadline": "switch",
        "grid_fallback": "switch",
        "comfort": "number",
        "safety": "number",
        "nominal": "number",
        "power_limit": "number",
        "min_on_power": "number",
        "min_soc": "number",
        "max_soc": "number",
        "deadline_soc": "number",
        "deadline_time": "time",
        "car_status": "sensor",
    }.get(kind, "sensor")


def _kinds_for_role(role: str) -> set[str]:
    """Welche Entitäten-Kinds eine Rolle besitzt (Spiegel der Plattformen)."""
    if role == "fahrzeug":
        # Autos sind reine Überwachung (keine Priorität/Pfeile), haben aber
        # eigene Lade-Ziele als Entitäten – passend zur Trennung von Auto und
        # Wallbox (siehe number.py/time.py/switch.py).
        return {
            "car_status",
            "power_charge",
            "grid_min",
            "grid_deadline",
            "min_soc",
            "max_soc",
            "deadline_soc",
            "deadline_time",
        }
    base = {"rank", "status", "up", "down", "auto"}
    if role == "wallbox":
        base |= {
            "power_charge",
            "grid_min",
            "grid_deadline",
            "min_soc",
            "max_soc",
            "deadline_soc",
            "deadline_time",
            "power_limit",
            "min_on_power",
        }
    elif role == "waermepumpe":
        base |= {"grid_fallback", "comfort", "safety"}
    elif role == "verbraucher":
        base |= {"nominal"}
    return base


def _resolve_entity(registry: Any, platform: str, unique_id: str) -> str | None:
    """Ermittelt die entity_id zu einer unique_id (fehlertolerant)."""
    if registry is None:
        return None
    try:
        return registry.async_get_entity_id(platform, DOMAIN, unique_id)
    except Exception:  # noqa: BLE001 - Registry-API kann sich ändern
        return None


def build_entity_map(
    registry: Any, config: dict[str, Any] | None
) -> dict[str, Any]:
    """Baut das Entitäten-Mapping für das Panel.

    ``registry`` ist das EntityRegistry-Objekt (oder ein Test-Stub).
    Liefert::

        {
          "surplus": "sensor.pvm_ueberschuss", ...,     # globale Entitäten
          "devices": {
            "<device_id>": {"auto": "...", "min_soc": "...", ...},
          },
        }
    """
    config = config or {}
    entities: dict[str, Any] = {}
    for key, unique in GLOBAL_IDS.items():
        entities[key] = _resolve_entity(registry, _platform_of(key), unique)

    devices: dict[str, dict[str, str | None]] = {}
    for device in config.get("devices", []) or []:
        device_id = str(device.get("id", ""))
        if not device_id:
            continue
        role = str(device.get("role", ""))
        mapped: dict[str, str | None] = {}
        for kind, prefix in DEVICE_PREFIXES.items():
            if kind not in _kinds_for_role(role):
                continue
            mapped[kind] = _resolve_entity(
                registry, _platform_of(kind), f"{prefix}_{device_id}"
            )
        devices[device_id] = mapped
    entities["devices"] = devices
    return entities


def build_panel_payload(
    manager: Any, registry: Any = None
) -> dict[str, Any]:
    """Komplettes Datenpaket für die Panel-Seite.

    ``manager`` liefert Konfiguration, Scan-Ergebnis und Setup-Stufe.
    Ohne übergebenes ``registry`` wird es aus dem HA-Manager geholt.
    """
    if registry is None:
        from homeassistant.helpers import entity_registry as er

        registry = er.async_get(manager.hass)

    config: dict[str, Any] = manager.config or {}
    # Scan-Ergebnis: gespeicherte Funde (kein erneutes Suchen nach Neustart),
    # aber bereits übernommene Vorschläge sind ausgeblendet.
    scan = (
        manager.scan_sets_visible()
        if hasattr(manager, "scan_sets_visible")
        else (manager.last_scan or {})
    )
    return {
        "config": config,
        "entities": build_entity_map(registry, config),
        "scan": scan,
        "setup": manager.setup_stage(),
        "version": VERSION,
        "instance": getattr(manager, "instance_id", None),
    }
