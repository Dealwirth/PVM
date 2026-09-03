"""Uhrzeit-Entitäten für PVM (Frist-Zeit je Auto)."""

from __future__ import annotations

import logging
from datetime import time as Time

from homeassistant.components.time import TimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, ENTITY_LABELS, ROLE_WALLBOX
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)

DEFAULT_DEADLINE = Time(18, 0)


def _to_time(value: str | None) -> Time:
    if not value:
        return DEFAULT_DEADLINE
    try:
        hours, minutes = value.split(":")
        return Time(int(hours) % 24, int(minutes) % 60)
    except (ValueError, AttributeError):
        return DEFAULT_DEADLINE


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Richtet die Frist-Zeiten für Wallboxen ein."""
    manager: PvmManager = hass.data[DOMAIN][entry.entry_id]
    entities = [
        PvmDeadlineTime(manager, device["id"])
        for device in manager.config.get("devices", [])
        if device.get("role") == ROLE_WALLBOX and device.get("car")
    ]
    async_add_entities(entities)


class PvmDeadlineTime(TimeEntity):
    """Uhrzeit, bis zu der das Frist-Ziel erreicht sein soll."""

    _attr_should_poll = False
    _attr_icon = "mdi:clock-outline"

    def __init__(self, manager: PvmManager, device_id: str) -> None:
        super().__init__()
        self.manager = manager
        self.device_id = device_id
        device = manager.get_device(device_id) or {}
        self._attr_name = (
            f"{device.get('name', 'Gerät')} – {ENTITY_LABELS['deadline_time']}"
        )
        self._attr_unique_id = f"{DOMAIN}_deadline_time_{device_id}"
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
            _LOGGER.debug("Zeit-Update fehlgeschlagen", exc_info=True)

    @property
    def native_value(self) -> Time:
        device = self.manager.get_device(self.device_id) or {}
        car = device.get("car") or {}
        return _to_time(car.get("deadline_time"))

    async def async_set_value(self, value: Time) -> None:
        text = f"{value.hour:02d}:{value.minute:02d}"
        self.manager.set_device_flag(self.device_id, "car.deadline_time", text)
        self.async_write_ha_state()
