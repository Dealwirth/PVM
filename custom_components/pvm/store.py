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
        # Scan-Ergebnis („Gefunden“) in einer eigenen Datei: so bleibt es auch
        # nach einem HA-Neustart erhalten und der Nutzer muss nicht jedes Mal
        # neu suchen – unabhängig von der normalisierten Konfiguration.
        self._scan_store = Store[dict[str, Any]](
            hass, STORAGE_VERSION, f"{STORAGE_KEY}.scan", atomic_writes=True
        )
        self._config: dict[str, Any] | None = None
        self._scan: dict[str, Any] | None = None

    async def async_load_scan(self) -> dict[str, Any]:
        """Lädt das zuletzt gespeicherte Scan-Ergebnis („Gefunden“)."""
        data = await self._scan_store.async_load()
        scan = dict(data) if isinstance(data, dict) else {}
        self._scan = scan
        return scan

    async def async_save_scan(self, scan: dict[str, Any]) -> None:
        """Speichert das Scan-Ergebnis dauerhaft (kein erneutes Suchen)."""
        self._scan = dict(scan)
        try:
            await self._scan_store.async_save(dict(scan))
        except Exception:  # noqa: BLE001 - Speichern darf nie blockieren
            _LOGGER.debug(
                "PVM: Scan-Ergebnis konnte nicht gespeichert werden", exc_info=True
            )

    async def async_delete(self) -> None:
        """Entfernt die gespeicherte Konfiguration dauerhaft (beim Löschen)."""
        self._config = None
        self._scan = None
        try:
            await self._store.async_remove()
        except Exception:  # noqa: BLE001 - Fehlen der Datei ist kein Fehler
            _LOGGER.debug(
                "PVM: Gespeicherte Konfiguration konnte nicht entfernt werden",
                exc_info=True,
            )
        try:
            await self._scan_store.async_remove()
        except Exception:  # noqa: BLE001
            _LOGGER.debug(
                "PVM: Gespeichertes Scan-Ergebnis konnte nicht entfernt werden",
                exc_info=True,
            )
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
