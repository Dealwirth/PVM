"""Sensoren für PVM (globaler Status + Geräte-Status)."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN,
    ENTITY_LABELS,
    MODE_LABELS,
    ROLE_FAHRZEUG,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
    STALE_SOC_AFTER_S,
)
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Richtet die Sensoren für einen PVM-Config-Eintrag ein."""
    manager: PvmManager = hass.data[DOMAIN][entry.entry_id]
    entities: list[SensorEntity] = [
        PvmSurplusSensor(manager),
        PvmStatusSensor(manager),
        PvmSetupSensor(manager),
    ]
    for device in manager.config.get("devices", []):
        if device.get("role") == ROLE_FAHRZEUG:
            entities.append(PvmCarStatusSensor(manager, device))
            continue
        entities.append(PvmRankSensor(manager, device))
        entities.append(PvmDeviceStatusSensor(manager, device))
        if device.get("role") == ROLE_WAERMEPUMPE:
            entities.append(PvmWpTestResultSensor(manager, device))
    async_add_entities(entities)


class _PvmSensor(SensorEntity):
    """Basis für PVM-Sensoren mit Manager-Subscription."""

    _attr_should_poll = False
    _unrecorded_attributes = frozenset()

    def __init__(self, manager: PvmManager) -> None:
        super().__init__()
        self.manager = manager
        self._unsub = manager.subscribe(self._refresh)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        self._unsub()
        await super().async_will_remove_from_hass()

    def _refresh(self) -> None:
        try:
            self.async_write_ha_state()
        except Exception:  # noqa: BLE001
            _LOGGER.debug("Sensor-Update fehlgeschlagen", exc_info=True)


class PvmSurplusSensor(_PvmSensor):
    """Verfügbarer PV-Überschuss (nach Reserve)."""

    _attr_has_entity_name = True
    _attr_translation_key = "surplus"
    _attr_device_class = SensorDeviceClass.POWER
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "W"
    _attr_suggested_display_precision = 0
    _attr_unique_id = f"{DOMAIN}_surplus"

    @property
    def native_value(self) -> float:
        return self.manager.surplus_w

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "valid": self.manager.surplus_valid,
            "export_w": self.manager.export_raw_w,
            "grid_w": self.manager.grid_w,
            "pv_w": self.manager.pv_w,
            "house_w": self.manager.house_w,
            "battery_w": self.manager.battery_w,
            "battery_soc": self.manager.battery_soc,
            "reserve_w": self.manager.config.get("settings", {}).get("reserve_w", 0),
        }


class PvmSetupSensor(_PvmSensor):
    """Einrichtungs-Fortschritt für Tutorial & Status (start/messungen/bereit)."""

    _attr_has_entity_name = True
    _attr_translation_key = "setup"
    _attr_icon = "mdi:school-outline"
    _attr_unique_id = f"{DOMAIN}_setup"
    _attr_entity_registry_enabled_default = True

    @property
    def native_value(self) -> str:
        return self.manager.setup_stage_label()

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        config = self.manager.config
        energy = config.get("energy", {})
        return {
            "stage": self.manager.setup_stage(),
            "missing": self.manager.setup_missing(),
            "device_count": len(config.get("devices", [])),
            "energy": {
                key: bool(energy.get(f"{key}_sensor"))
                for key in (
                    "pv", "grid", "grid_import", "grid_export", "house",
                    "battery_power", "battery_soc",
                )
            },
        }


class PvmStatusSensor(_PvmSensor):
    """Globaler Status der Engine."""

    _attr_has_entity_name = True
    _attr_translation_key = "engine_status"
    _attr_icon = "mdi:heart-pulse"
    _attr_unique_id = f"{DOMAIN}_status"
    _attr_entity_registry_enabled_default = True

    @property
    def native_value(self) -> str:
        return self.manager.status_sensor_value()

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        settings = self.manager.config.get("settings", {})
        devices = []
        for device in self.manager.config.get("devices", []):
            state = self.manager.device_state.get(device["id"])
            devices.append(
                {
                    "name": device.get("name"),
                    "role": device.get("role"),
                    "rank": self.manager.rank_of(device["id"]),
                    "enabled": device.get("enabled"),
                    **(
                        {
                            "target": state.get("target"),
                            "reason": state.get("reason"),
                            "reason_label": state.get("reason_label"),
                            "power_w": state.get("power_w"),
                        }
                        if state
                        else {}
                    ),
                }
            )
        return {
            "mode": settings.get("mode"),
            "mode_label": MODE_LABELS.get(settings.get("mode"), settings.get("mode")),
            "last_cycle_ts": self.manager.last_cycle_ts,
            "last_error": self.manager.last_error,
            "consecutive_errors": self.manager.consecutive_errors,
            "device_count": len(self.manager.config.get("devices", [])),
            "devices": devices,
            "scan": {
                k: v
                for k, v in self.manager.last_scan.get("new_candidates", {}).items()
                if v
            }
            if self.manager.last_scan
            else {},
        }


class _PvmDeviceSensor(_PvmSensor):
    """Basis für gerätebezogene Sensoren."""

    def __init__(self, manager: PvmManager, device: dict) -> None:
        super().__init__(manager)
        self.device = device
        self.device_id = device["id"]

    @property
    def device_name(self) -> str:
        return str(self.device.get("name", "Gerät"))


class PvmRankSensor(_PvmDeviceSensor):
    """Rang des Geräts in der Prioritätenliste."""

    _attr_icon = "mdi:sort-numeric-ascending"
    _attr_should_poll = False

    def __init__(self, manager: PvmManager, device: dict) -> None:
        super().__init__(manager, device)
        self._attr_unique_id = f"{DOMAIN}_rank_{self.device_id}"
        self._attr_name = f"{self.device_name} – {ENTITY_LABELS['rank']}"

    @property
    def native_value(self) -> int:
        return self.manager.rank_of(self.device_id)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "role": self.device.get("role"),
            "enabled": self.device.get("enabled", True),
        }


class PvmDeviceStatusSensor(_PvmDeviceSensor):
    """Status-Text eines Geräts mit Details zur letzten Aktion."""

    _attr_should_poll = False

    def __init__(self, manager: PvmManager, device: dict) -> None:
        super().__init__(manager, device)
        self._attr_unique_id = f"{DOMAIN}_status_{self.device_id}"
        self._attr_name = f"{self.device_name} – {ENTITY_LABELS['status']}"

    @property
    def native_value(self) -> str:
        return self.manager.device_status_sensor_value(self.device)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        attrs: dict[str, Any] = {
            "on": self.manager.device_state_on(self.device),
            "rank": self.manager.rank_of(self.device_id),
        }
        state = self.manager.device_state.get(self.device_id)
        if state:
            attrs["last_reason"] = state.get("reason")
            attrs["last_reason_label"] = state.get("reason_label")
            attrs["last_target"] = state.get("target")
            attrs["last_power_w"] = state.get("power_w")
            attrs["last_change_ts"] = state.get("ts")
        if self.device.get("role") == ROLE_WALLBOX and self.device.get("sensors", {}).get("soc"):
            correlation = self.manager.correlation_ok(self.device_id)
            if correlation is not None:
                attrs["correlation_ok"] = correlation
        return attrs


class PvmCarStatusSensor(_PvmDeviceSensor):
    """Status eines E-Autos: lädt an welcher Wallbox – oder unterwegs.

    Die Zuordnung erfolgt vollautomatisch über die Ladeleistungen
    (verschiedene Wallboxen haben verschiedene Leistungen → Vergleich).
    """

    _attr_icon = "mdi:car"
    _attr_entity_registry_enabled_default = True

    def __init__(self, manager: PvmManager, device: dict) -> None:
        super().__init__(manager, device)
        self._attr_unique_id = f"{DOMAIN}_car_status_{self.device_id}"
        self._attr_name = f"{self.device_name} – Status"

    @property
    def native_value(self) -> str:
        return self.manager.car_status.get(self.device_id, "unbekannt")

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        sensors = self.device.get("sensors", {}) or {}
        power, _valid = self.manager.read_power(sensors.get("power"))
        soc, _svalid = self.manager.read_number(
            sensors.get("soc"), stale_s=STALE_SOC_AFTER_S
        )
        wallbox_id = self.manager.car_assignments.get(self.device_id)
        attrs: dict[str, Any] = {
            "power_w": power,
            "soc": soc,
            "charging": bool(
                power is not None and power >= 60.0
            ),
            "wallbox_id": wallbox_id,
        }
        if wallbox_id:
            wallbox = self.manager.get_device(wallbox_id)
            attrs["wallbox_name"] = wallbox.get("name") if wallbox else None
        # Gelernte/manuell gesetzte Heimat-Wallbox (für Automationen sichtbar)
        home = (self.device.get("car") or {}).get("home_wallbox")
        attrs["home_wallbox_id"] = home or None
        if home:
            home_wallbox = self.manager.get_device(home)
            attrs["home_wallbox_name"] = (
                home_wallbox.get("name") if home_wallbox else None
            )
        return attrs


class PvmWpTestResultSensor(_PvmDeviceSensor):
    """Ergebnis des letzten WP-Kalibrierungstests."""

    _attr_icon = "mdi:thermometer-lines"

    def __init__(self, manager: PvmManager, device: dict) -> None:
        super().__init__(manager, device)
        self._attr_unique_id = f"{DOMAIN}_wp_test_result_{self.device_id}"
        self._attr_name = f"{self.device_name} – {ENTITY_LABELS['wp_test_result']}"

    @property
    def native_value(self) -> str:
        result = self.manager.wp_test_result(self.device_id)
        if result is None:
            return "Kein Test"
        running = bool(self.device.get("wp", {}).get("test_active"))
        if running:
            return "Test läuft"
        return str(result.get("status_label", result.get("status", "")))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        result = self.manager.wp_test_result(self.device_id)
        if not result:
            return {}
        running = bool(self.device.get("wp", {}).get("test_active"))
        return {**result, "running": running}
