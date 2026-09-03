"""WebSocket-Kommandos für das eigene PVM-Panel.

Die Seite kommuniziert ausschließlich über diese Kommandos mit Home
Assistant – keine REST-API, keine Config-Flow-Dialoge.
"""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .config_model import normalize_config
from .const import DOMAIN
from .manager import PvmManager
from .panel_data import build_panel_payload

_LOGGER = logging.getLogger(__name__)


def _get_manager(hass: HomeAssistant) -> PvmManager | None:
    """Liefert den Manager der (Single-)Instanz."""
    for entry_id, manager in hass.data.get(DOMAIN, {}).items():
        if entry_id != f"{DOMAIN}_services":
            return manager
    return None


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/get_config"}
)
@websocket_api.async_response
async def ws_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Liefert Konfiguration, Entitäten-Mapping und Scan-Ergebnis."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    connection.send_result(msg["id"], build_panel_payload(manager))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_config",
        vol.Required("config"): dict,
    }
)
@websocket_api.async_response
async def ws_save_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Übernimmt die komplette Konfiguration aus dem Panel."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    normalized = normalize_config(msg["config"])
    await manager.async_replace_config(normalized)
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/scan"})
@websocket_api.async_response
async def ws_scan(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Startet die Geräte-/Sensor-Erkennung und liefert das Ergebnis."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    result = await manager.scan_devices()
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/list_entities"}
)
@websocket_api.async_response
async def ws_list_entities(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Liefert alle relevanten Entitäten für die Auswahl-Dialoge."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    connection.send_result(msg["id"], {"entities": manager.collect_entities()})


async def async_register_websocket(hass: HomeAssistant) -> None:
    """Registriert alle PVM-WebSocket-Kommandos (einmalig)."""
    if f"{DOMAIN}_ws" in hass.data:
        return
    hass.data[f"{DOMAIN}_ws"] = True
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_save_config)
    websocket_api.async_register_command(hass, ws_scan)
    websocket_api.async_register_command(hass, ws_list_entities)
    _LOGGER.debug("PVM-WebSocket-Kommandos registriert")
