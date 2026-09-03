"""Persistenz für die PVM-Konfiguration (Home-Assistant-JSON-Store)."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .config_model import normalize_config
from .const import STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


class PvmStore:
    """Kapselt Laden/Speichern der kompletten PVM-Konfiguration."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store[dict[str, Any]](
            hass, STORAGE_VERSION, STORAGE_KEY, atomic_writes=True
        )
        self._config: dict[str, Any] | None = None

    async def async_load(self) -> dict[str, Any]:
        """Lädt die Konfiguration (mit Defaults und Normalisierung)."""
        data = await self._store.async_load()
        self._config = normalize_config(data)
        _LOGGER.debug(
            "PVM-Konfiguration geladen: %d Geräte", len(self._config["devices"])
        )
        return self._config

    async def async_save(self, config: dict[str, Any]) -> None:
        """Speichert die Konfiguration."""
        normalized = normalize_config(config)
        await self._store.async_save(normalized)
        self._config = normalized
