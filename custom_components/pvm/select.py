"""Select-Entität für den globalen PVM-Modus."""

from __future__ import annotations

import logging

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DEFAULT_UI_THEME,
    DOMAIN,
    MODE_LABELS,
    MODES,
    UI_THEME_LABELS,
    UI_THEMES,
)
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)

LABEL_TO_MODE = {label: mode for mode, label in MODE_LABELS.items()}
THEME_LABEL_TO_KEY = {label: key for key, label in UI_THEME_LABELS.items()}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Richtet Modus- und Design-Select ein."""
    manager: PvmManager = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([PvmModeSelect(manager), PvmThemeSelect(manager)])


class PvmModeSelect(SelectEntity):
    """Wählt den Betriebsmodus (Auto, Nur Überschuss, …)."""

    _attr_has_entity_name = True
    _attr_translation_key = "mode"
    _attr_icon = "mdi:tune"
    _attr_should_poll = False
    _attr_unique_id = f"{DOMAIN}_mode"

    def __init__(self, manager: PvmManager) -> None:
        super().__init__()
        self.manager = manager
        self._attr_options = [MODE_LABELS[mode] for mode in MODES]
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
            _LOGGER.debug("Select-Update fehlgeschlagen", exc_info=True)

    @property
    def current_option(self) -> str:
        mode = self.manager.config.get("settings", {}).get("mode")
        return MODE_LABELS.get(mode, MODE_LABELS["auto"])

    async def async_select_option(self, option: str) -> None:
        mode = LABEL_TO_MODE.get(option)
        if mode is None:
            return
        self.manager.set_setting("mode", mode)
        self.async_write_ha_state()


class PvmThemeSelect(SelectEntity):
    """Wählt das Dashboard-Design (Sonnenaufgang/Natur-frisch/Kühl & klar)."""

    _attr_has_entity_name = True
    _attr_translation_key = "theme"
    _attr_icon = "mdi:palette-swatch-outline"
    _attr_should_poll = False
    _attr_unique_id = f"{DOMAIN}_theme"

    def __init__(self, manager: PvmManager) -> None:
        super().__init__()
        self.manager = manager
        self._attr_options = [UI_THEME_LABELS[theme] for theme in UI_THEMES]
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
            _LOGGER.debug("Design-Select-Update fehlgeschlagen", exc_info=True)

    @property
    def current_option(self) -> str:
        theme = self.manager.config.get("settings", {}).get(
            "ui_theme", DEFAULT_UI_THEME
        )
        return UI_THEME_LABELS.get(theme, UI_THEME_LABELS[DEFAULT_UI_THEME])

    async def async_select_option(self, option: str) -> None:
        theme = THEME_LABEL_TO_KEY.get(option)
        if theme is None:
            return
        self.manager.set_setting("ui_theme", theme)
        self.async_write_ha_state()
        # Dashboard sofort im neuen Look neu aufbauen
        from .dashboard_creator import async_rebuild_dashboard

        self.hass.async_create_task(async_rebuild_dashboard(self.manager))
