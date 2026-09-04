"""Buttons für PVM (Scan, Dashboard, Prioritäten)."""

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN,
    ENTITY_LABELS,
    ROLE_FAHRZEUG,
)
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Richtet die Buttons ein."""
    manager: PvmManager = hass.data[DOMAIN][entry.entry_id]
    entities: list[ButtonEntity] = [
        PvmScanButton(manager),
        PvmRebuildDashboardButton(manager),
    ]
    for device in manager.config.get("devices", []):
        if device.get("role") == ROLE_FAHRZEUG:
            continue  # Autos sind reine Überwachung (keine Prioritäts-Buttons)
        entities.append(PvmPriorityButton(manager, device["id"], "up"))
        entities.append(PvmPriorityButton(manager, device["id"], "down"))
    async_add_entities(entities)


class PvmButton(ButtonEntity):
    """Basis-Button."""

    _attr_should_poll = False

    def __init__(self, manager: PvmManager) -> None:
        super().__init__()
        self.manager = manager


class PvmScanButton(PvmButton):
    """Startet die automatische Gerätesuche."""

    _attr_has_entity_name = True
    _attr_translation_key = "scan"
    _attr_icon = "mdi:magnify"
    _attr_unique_id = f"{DOMAIN}_scan"

    def __init__(self, manager: PvmManager) -> None:
        super().__init__(manager)

    async def async_press(self) -> None:
        await self.manager.scan_devices()


class PvmRebuildDashboardButton(PvmButton):
    """Registriert die PVM-Seite neu bzw. aktualisiert sie."""

    _attr_has_entity_name = True
    _attr_translation_key = "rebuild_dashboard"
    _attr_icon = "mdi:view-dashboard-edit"
    _attr_unique_id = f"{DOMAIN}_rebuild"

    def __init__(self, manager: PvmManager) -> None:
        super().__init__(manager)

    async def async_press(self) -> None:
        from .panel import async_rebuild_panel

        await async_rebuild_panel(self.hass, self.manager)


class PvmPriorityButton(PvmButton):
    """Verschiebt ein Gerät in der Prioritätenliste."""

    def __init__(self, manager: PvmManager, device_id: str, direction: str) -> None:
        super().__init__(manager)
        self.device_id = device_id
        self.direction = direction
        device = manager.get_device(device_id) or {}
        name = device.get("name", "Gerät")
        if direction == "up":
            self._attr_icon = "mdi:chevron-up"
            self._attr_name = f"{name} – {ENTITY_LABELS['up']}"
        else:
            self._attr_icon = "mdi:chevron-down"
            self._attr_name = f"{name} – {ENTITY_LABELS['down']}"
        self._attr_unique_id = f"{DOMAIN}_prio_{direction}_{device_id}"

    async def async_press(self) -> None:
        self.manager.move_priority(self.device_id, -1 if self.direction == "up" else 1)



