"""Schalter für PVM (Automatik, Power Charge, Netz-Freigaben)."""

from __future__ import annotations

import logging

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN,
    ENTITY_LABELS,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
)
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)

# Schalter je Rolle: (Schlüssel, Pfad, Standard-Zustand)
DEVICE_SWITCHES = {
    ROLE_WALLBOX: [
        ("auto", "enabled", True),
        ("power_charge", "car.manual_force", False),
        ("grid_min", "car.grid_min_allowed", True),
        ("grid_deadline", "car.grid_deadline_allowed", True),
    ],
    ROLE_WAERMEPUMPE: [
        ("auto", "enabled", True),
        ("grid_fallback", "wp.grid_fallback_allowed", True),
    ],
    "verbraucher": [
        ("auto", "enabled", True),
    ],
}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Richtet die Schalter ein."""
    manager: PvmManager = hass.data[DOMAIN][entry.entry_id]
    entities: list[SwitchEntity] = []
    for device in manager.config.get("devices", []):
        for kind, path, default in DEVICE_SWITCHES.get(device.get("role"), []):
            entities.append(PvmDeviceSwitch(manager, device["id"], kind, path, default))
    async_add_entities(entities)


class PvmSwitch(SwitchEntity):
    """Basis mit Manager-Subscription."""

    _attr_should_poll = False

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
            _LOGGER.debug("Schalter-Update fehlgeschlagen", exc_info=True)


class PvmDeviceSwitch(PvmSwitch):
    """Ein Schalter eines Geräts (Automatik, Netz-Freigabe, Power Charge)."""

    def __init__(
        self,
        manager: PvmManager,
        device_id: str,
        kind: str,
        path: str,
        default: bool,
    ) -> None:
        super().__init__(manager)
        self.device_id = device_id
        self.kind = kind
        self.path = path
        self.default = default
        self._attr_unique_id = f"{DOMAIN}_{kind}_{device_id}"
        device = manager.get_device(device_id) or {}
        self._attr_name = (
            f"{device.get('name', 'Gerät')} – {ENTITY_LABELS.get(kind, kind)}"
        )

    @property
    def is_on(self) -> bool:
        device = self.manager.get_device(self.device_id) or {}
        value: object = device
        for part in self.path.split("."):
            value = value.get(part, self.default) if isinstance(value, dict) else self.default
        return bool(value)

    async def async_turn_on(self, **kwargs) -> None:
        self.manager.set_device_flag(self.device_id, self.path, True)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self.manager.set_device_flag(self.device_id, self.path, False)
        self.async_write_ha_state()

    @property
    def icon(self) -> str:
        icons = {
            "auto": "mdi:toggle-switch",
            "power_charge": "mdi:lightning-bolt",
            "grid_min": "mdi:transmission-tower",
            "grid_deadline": "mdi:clock-alert",
            "grid_fallback": "mdi:alert-decagram",
        }
        return icons.get(self.kind, "mdi:toggle-switch")



