"""Diagnose-Daten für PVM (Herunterladen über die Integrations-Seite)."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, VERSION


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Liefert Diagnose-Daten (ohne sensible Inhalte)."""
    manager = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if manager is None:
        return {"version": VERSION, "error": "manager not loaded"}

    devices = []
    for device in manager.config.get("devices", []):
        devices.append(
            {
                "id": device["id"],
                "name": device.get("name"),
                "role": device.get("role"),
                "enabled": device.get("enabled"),
                "control_type": device.get("control", {}).get("type"),
                "switch_entity": device.get("control", {}).get("switch_entity"),
                "number_entity": device.get("control", {}).get("number_entity"),
                "sensors": device.get("sensors", {}),
                "status": manager.device_state.get(device["id"]),
            }
        )

    energy = dict(manager.config.get("energy", {}))
    settings = dict(manager.config.get("settings", {}))

    return {
        "version": VERSION,
        "energy_sensors": energy,
        "settings": settings,
        "device_count": len(devices),
        "devices": devices,
        "engine": {
            "surplus_w": manager.surplus_w,
            "surplus_valid": manager.surplus_valid,
            "battery_w": manager.battery_w,
            "battery_soc": manager.battery_soc,
            "last_cycle_ts": manager.last_cycle_ts,
            "last_error": manager.last_error,
            "consecutive_errors": manager.consecutive_errors,
        },
        "cars": {
            "assignments": manager.car_assignments,
            "status": manager.car_status,
        },
        "forecast": getattr(manager, "forecast_data", None),
        "last_scan": {
            k: v
            for k, v in (manager.last_scan or {}).items()
            if k in ("energy", "devices", "count", "ts")
        },
    }
