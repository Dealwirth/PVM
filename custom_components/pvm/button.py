"""Buttons für PVM (Scan, Dashboard, Prioritäten, WP-Test)."""

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN,
    ENTITY_LABELS,
    ROLE_WAERMEPUMPE,
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
        entities.append(PvmPriorityButton(manager, device["id"], "up"))
        entities.append(PvmPriorityButton(manager, device["id"], "down"))
        if device.get("role") == ROLE_WAERMEPUMPE:
            entities.append(PvmWpTestButton(manager, device["id"], start=True))
            entities.append(PvmWpTestButton(manager, device["id"], start=False))
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
    """Erstellt das Dashboard neu bzw. aktualisiert es."""

    _attr_has_entity_name = True
    _attr_translation_key = "rebuild_dashboard"
    _attr_icon = "mdi:view-dashboard-edit"
    _attr_unique_id = f"{DOMAIN}_rebuild"

    def __init__(self, manager: PvmManager) -> None:
        super().__init__(manager)

    async def async_press(self) -> None:
        from .dashboard_creator import async_rebuild_dashboard

        await async_rebuild_dashboard(self.manager, notify=True)


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


class PvmWpTestButton(PvmButton):
    """Startet bzw. bricht den WP-Kalibrierungstest ab."""

    def __init__(self, manager: PvmManager, device_id: str, start: bool) -> None:
        super().__init__(manager)
        self.device_id = device_id
        self._start = start
        device = manager.get_device(device_id) or {}
        name = device.get("name", "Gerät")
        if start:
            self._attr_icon = "mdi:play"
            self._attr_name = f"{name} – {ENTITY_LABELS['test_start']}"
        else:
            self._attr_icon = "mdi:stop"
            self._attr_name = f"{name} – {ENTITY_LABELS['test_abort']}"
        self._attr_unique_id = f"{DOMAIN}_wp_test_{'start' if start else 'abort'}_{device_id}"

    async def async_press(self) -> None:
        if self._start:
            await self.manager.wp_test_start(self.device_id)
        else:
            await self.manager.wp_test_abort(self.device_id)
