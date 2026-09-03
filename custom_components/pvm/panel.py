"""Registrierung der eigenen PVM-Seite (Sidebar-Panel).

Ersetzt das frühere Lovelace-Dashboard: PVM erscheint als eigenständige
Seite in der Seitenleiste („PV Manager“) und lädt dort eine komplett
selbst gebaute HTML/JS/CSS-Oberfläche – kein Lovelace, keine YAML.

Mechanik (Stand HA 2025.x, identisch zu HACS):
- ``hass.http.async_register_static_paths`` serviert die Panel-Dateien
  unter ``/pvm_panel``.
- ``frontend.async_register_built_in_panel`` registriert das Seitenleisten-
  Panel mit ``component_name="custom"`` und ``_panel_custom``-Config;
  ``embed_iframe: True`` bettet unsere Seite in einen Same-Origin-iframe
  ein, der das authentifizierte ``hass``-Objekt erhält.
"""

from __future__ import annotations

import logging
import os

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN, NAME
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)

PANEL_URL = "pvm"
PANEL_STATIC_PATH = "/pvm_panel"
PANEL_DIR_NAME = "panel"
PANEL_FILE = "panel.js"
PANEL_ELEMENT = "pvm-panel"

# Altes Lovelace-Dashboard (vor 1.2.0 erzeugt) – wird beim Registrieren
# entfernt, damit keine doppelte „PV Manager“-Seite übrig bleibt.
OLD_DASHBOARD_URL = "pvm-dashboard"


def panel_dir() -> str:
    """Absoluter Pfad zum Panel-Ordner der Integration."""
    return os.path.join(os.path.dirname(__file__), PANEL_DIR_NAME)


def collect_entities(manager: PvmManager) -> list[dict]:
    """Rohe Entitätenliste für die Auswahl-Dialoge des Panels."""
    return manager.collect_entities()


async def async_register_panel(hass: HomeAssistant, manager: PvmManager) -> None:
    """Registriert die Panel-Dateien und die Seitenleisten-Seite."""
    from homeassistant.components.frontend import async_register_built_in_panel
    from homeassistant.components.http import StaticPathConfig

    path = panel_dir()
    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_STATIC_PATH, path, cache_headers=False)]
    )

    try:
        async_register_built_in_panel(
            hass,
            "custom",
            sidebar_title=NAME,
            sidebar_icon="mdi:solar-power",
            frontend_url_path=PANEL_URL,
            config={
                "_panel_custom": {
                    "name": PANEL_ELEMENT,
                    "embed_iframe": True,
                    "trust_external": False,
                    "module_url": f"{PANEL_STATIC_PATH}/{PANEL_FILE}",
                    "js_url": f"{PANEL_STATIC_PATH}/{PANEL_FILE}",
                }
            },
            require_admin=False,
            update=True,
        )
    except Exception:  # noqa: BLE001
        _LOGGER.warning("PVM: Seitenleisten-Panel konnte nicht registriert werden", exc_info=True)
        return

    await _remove_old_lovelace_dashboard(hass)
    _LOGGER.info("PVM: Seitenleisten-Seite „%s“ aktiv (%s)", NAME, PANEL_URL)

    # Einmaliger Kurzhinweis nach der Installation (nur wenn noch nichts
    # konfiguriert ist – danach wird er nie wieder angezeigt).
    config = manager.config or {}
    energy = config.get("energy", {}) or {}
    fresh = not config.get("devices") and not (
        energy.get("pv_sensor") or energy.get("grid_sensor")
    )
    if fresh:
        hass.components.persistent_notification.async_create(
            title="PV Manager ist bereit ☀️",
            message=(
                "Weitere Einrichtung und Einstellungen findest du in der "
                "**PV-Manager-Seite** in der Seitenleiste "
                "(Erste Schritte → Sensoren und Geräte hinzufügen)."
            ),
            notification_id=f"{DOMAIN}_dashboard_ready",
        )


async def async_rebuild_panel(hass: HomeAssistant, manager: PvmManager) -> None:
    """Registriert das Panel neu (nach HA-Updates/Fehlern)."""
    await async_register_panel(hass, manager)


async def _remove_old_lovelace_dashboard(hass: HomeAssistant) -> None:
    """Entfernt das frühere Lovelace-Dashboard (wenn vorhanden)."""
    try:
        from homeassistant.components.lovelace import dashboard as ll_dashboard
        from homeassistant.components.lovelace.const import LOVELACE_DATA

        data = hass.data.get(LOVELACE_DATA)
        if data is None:
            return
        collection = ll_dashboard.DashboardsCollection(hass)
        await collection.async_load()
        for item in collection.async_items():
            if item.get("url_path") == OLD_DASHBOARD_URL:
                await collection.async_delete_item(item["id"])
                _LOGGER.info(
                    "PVM: Altes Lovelace-Dashboard „%s“ entfernt (durch eigene Seite ersetzt)",
                    OLD_DASHBOARD_URL,
                )
                return
    except Exception:  # noqa: BLE001 - Aufräumen darf nie blockieren
        _LOGGER.debug("PVM: Altes Dashboard konnte nicht entfernt werden", exc_info=True)


def entity_ids_for(manager: PvmManager, device_id: str | None = None) -> dict:
    """entity_id-Mapping (für Services/Tests) über die Registry."""
    registry = er.async_get(manager.hass)
    from .panel_data import build_entity_map

    return build_entity_map(registry, manager.config)
