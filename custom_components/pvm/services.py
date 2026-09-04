"""Services für PVM (für Automationen und Skripte)."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN, ROLE_FAHRZEUG, ROLE_WAERMEPUMPE
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)


def _get_manager(hass: HomeAssistant) -> PvmManager | None:
    """Liefert den Manager der (Single-)Instanz."""
    for entry_id, manager in hass.data.get(DOMAIN, {}).items():
        if entry_id != f"{DOMAIN}_services":
            return manager
    return None


def _resolve_device(hass: HomeAssistant, entity_id: str) -> dict | None:
    """Findet das PVM-Gerät, zu dem eine Entität gehört."""
    manager = _get_manager(hass)
    if manager is None:
        return None
    registry = er.async_get(hass)
    entry = next(
        (
            e
            for e in registry.entities.values()
            if e.entity_id == entity_id and getattr(e, "platform", None) == DOMAIN
        ),
        None,
    )
    if entry is None or not entry.unique_id:
        return None
    # Unique-IDs enden immer mit `_<device_id>`
    device_id = str(entry.unique_id).rsplit("_", 1)[-1]
    return manager.get_device(device_id)


def _bool_arg(call: ServiceCall, key: str, default: bool) -> bool:
    value = call.data.get(key, default)
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("true", "1", "on", "yes", "ja")


def _require_target(call: ServiceCall) -> dict:
    entity_id = call.data.get("entity_id")
    if not entity_id:
        raise ValueError("Parameter 'entity_id' fehlt (Entität des Geräts wählen)")
    if isinstance(entity_id, (list, tuple)):
        entity_id = entity_id[0]
    return {"entity_id": entity_id}


async def _async_handle_power_charge(hass: HomeAssistant, call: ServiceCall) -> None:
    """Schaltet Power Charge für ein Auto ein/aus."""
    manager = _get_manager(hass)
    if manager is None:
        return
    target = _require_target(call)
    device = _resolve_device(hass, target["entity_id"])
    if device is None or not device.get("car"):
        raise ValueError("Kein E-Auto an dieser Entität gefunden")
    manager.set_device_flag(device["id"], "car.manual_force", _bool_arg(call, "charge", True))


async def _async_handle_set_priority(hass: HomeAssistant, call: ServiceCall) -> None:
    """Setzt die Priorität eines Geräts (1 = höchste).

    Autos (reine Überwachung) belegen keine Prioritäts-Position – gezählt
    werden nur steuerbare Geräte, damit Nummern und Pfeile im Dashboard und
    der Rang-Sensor (`rank_of`) konsistent bleiben.
    """
    manager = _get_manager(hass)
    if manager is None:
        return
    target = _require_target(call)
    device = _resolve_device(hass, target["entity_id"])
    if device is None:
        raise ValueError("Kein PVM-Gerät an dieser Entität gefunden")
    if device.get("role") == ROLE_FAHRZEUG:
        raise ValueError("Autos sind reine Überwachung – sie haben keine Priorität")
    position = int(call.data.get("position", 1))
    if position < 1:
        position = 1
    devices = manager.config.get("devices", [])
    current = next((i for i, d in enumerate(devices) if d["id"] == device["id"]), None)
    if current is None:
        return
    controllable_idx = [
        i for i, d in enumerate(devices) if d.get("role") != ROLE_FAHRZEUG
    ]
    rank = controllable_idx.index(current)  # Position unter den steuerbaren
    target_rank = min(max(position - 1, 0), len(controllable_idx) - 1)
    if rank == target_rank:
        return
    item = devices.pop(current)
    insert_at = controllable_idx[target_rank]
    # Nach dem Entfernen rutschen Indizes > current um 1 nach links.
    if insert_at > current:
        insert_at -= 1
    devices.insert(insert_at, item)
    manager.schedule_save()
    manager.request_cycle()


async def _async_handle_deadline(hass: HomeAssistant, call: ServiceCall, clear: bool) -> None:
    """Setzt oder löscht ein zeitliches Ladeziel."""
    manager = _get_manager(hass)
    if manager is None:
        return
    target = _require_target(call)
    device = _resolve_device(hass, target["entity_id"])
    if device is None or not device.get("car"):
        raise ValueError("Kein E-Auto an dieser Entität gefunden")
    car = device["car"]
    if clear:
        car["deadline_soc"] = 0.0
    else:
        if "time" in call.data:
            # Zeit-Selector liefert z. B. "18:00:00"; wir speichern "HH:MM"
            raw = str(call.data["time"]).split("T")[-1]
            car["deadline_time"] = raw[:5]
        if "target_soc" in call.data:
            car["deadline_soc"] = max(
                0.0, min(100.0, float(call.data["target_soc"]))
            )
    manager.schedule_save()
    manager.request_cycle()


async def _async_handle_wp_test(hass: HomeAssistant, call: ServiceCall, start: bool) -> None:
    """Startet/bricht den WP-Kalibrierungstest ab."""
    manager = _get_manager(hass)
    if manager is None:
        return
    target = _require_target(call)
    device = _resolve_device(hass, target["entity_id"])
    if device is None or device.get("role") != ROLE_WAERMEPUMPE:
        raise ValueError("Keine Wärmepumpe an dieser Entität gefunden")
    if start:
        await manager.wp_test_start(device["id"])
    else:
        await manager.wp_test_abort(device["id"])


async def _async_handle_scan(hass: HomeAssistant, call: ServiceCall) -> None:
    """Startet die automatische Geräteerkennung."""
    manager = _get_manager(hass)
    if manager is None:
        return
    await manager.scan_devices()


async def _async_handle_rebuild_dashboard(hass: HomeAssistant, call: ServiceCall) -> None:
    """Registriert die PVM-Seite neu (nach Updates/Fehlern)."""
    from .panel import async_rebuild_panel

    manager = _get_manager(hass)
    if manager is None:
        return
    await async_rebuild_panel(hass, manager)
    await hass.services.async_call(
        "persistent_notification",
        "create",
        {
            "title": "PVM – Seite",
            "message": (
                "Die **PV-Manager-Seite** wurde neu registriert. "
                "Öffne sie über die Seitenleiste."
            ),
            "notification_id": f"{DOMAIN}_dashboard",
        },
    )


async def _async_handle_self_test(hass: HomeAssistant, call: ServiceCall) -> None:
    """Führt einen Selbsttest durch und zeigt das Ergebnis als Meldung."""
    manager = _get_manager(hass)
    if manager is None:
        return
    issues: list[str] = []
    config = manager.config

    if not (config.get("energy", {}).get("pv_sensor") or config.get("energy", {}).get("grid_sensor")):
        issues.append("Keine Energiesensoren konfiguriert (PV oder Netz).")
    for device in config.get("devices", []):
        control = device.get("control", {})
        name = device.get("name", "?")
        control_entities = [
            control.get(key)
            for key in ("switch_entity", "on_entity", "off_entity", "number_entity")
            if control.get(key)
        ]
        if not control_entities:
            issues.append(f"{name}: keine Steuer-Entität konfiguriert.")
        else:
            for entity_id in control_entities:
                if hass.states.get(entity_id) is None:
                    issues.append(
                        f"{name}: Steuer-Entität nicht gefunden ({entity_id})."
                    )
        sensors = device.get("sensors", {})
        for role_key, label in (("soc", "SoC"), ("temp", "Temperatur"), ("power", "Leistung")):
            if sensors.get(role_key) and hass.states.get(sensors[role_key]) is None:
                issues.append(f"{name}: {label}-Sensor nicht gefunden ({sensors[role_key]}).")
    if manager.last_error:
        issues.append(f"Letzter Engine-Fehler: {manager.last_error}")
    if not issues:
        issues.append("Alles in Ordnung – keine Probleme gefunden.")

    await hass.services.async_call(
        "persistent_notification",
        "create",
        {
            "title": "PVM – Selbsttest",
            "message": "\n".join(f"- {issue}" for issue in issues),
            "notification_id": f"{DOMAIN}_self_test",
        },
    )


async def async_register_services(hass: HomeAssistant) -> None:
    """Registriert alle PVM-Services."""
    services: dict[str, Any] = {
        "power_charge": lambda call: _async_handle_power_charge(hass, call),
        "set_priority": lambda call: _async_handle_set_priority(hass, call),
        "set_deadline": lambda call: _async_handle_deadline(hass, call, clear=False),
        "clear_deadline": lambda call: _async_handle_deadline(hass, call, clear=True),
        "wp_test_start": lambda call: _async_handle_wp_test(hass, call, start=True),
        "wp_test_abort": lambda call: _async_handle_wp_test(hass, call, start=False),
        "scan_devices": lambda call: _async_handle_scan(hass, call),
        "rebuild_dashboard": lambda call: _async_handle_rebuild_dashboard(hass, call),
        "run_self_test": lambda call: _async_handle_self_test(hass, call),
    }
    for service, handler in services.items():
        hass.services.async_register(DOMAIN, service, handler)
    _LOGGER.debug("PVM-Services registriert: %s", ", ".join(services))
