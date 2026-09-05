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
    try:
        normalized = normalize_config(msg["config"])
        await manager.async_replace_config(normalized)
        connection.send_result(
            msg["id"],
            {"ok": True, "instance": getattr(manager, "instance_id", None)},
        )
    except Exception as err:  # noqa: BLE001 - immer antworten, nie hängen
        _LOGGER.exception("PVM: Konfiguration konnte nicht gespeichert werden")
        connection.send_error(msg["id"], "save_failed", str(err))


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
    try:
        result = await manager.scan_devices()
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001 - immer antworten, nie hängen
        _LOGGER.exception("PVM: Scan fehlgeschlagen")
        connection.send_error(msg["id"], "scan_failed", str(err))


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


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/forecast"})
@websocket_api.async_response
async def ws_forecast(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Liefert die aktuelle PV-Prognose (Open-Meteo / lokales Modell)."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    connection.send_result(
        msg["id"], getattr(manager, "forecast_data", None) or {}
    )


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/analysis"})
@websocket_api.async_response
async def ws_analysis(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Liefert die PV-Analyse der letzten Tage (Sonnenstand-Kurve + Bilanzen)."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    try:
        result = await manager.build_analysis()
        connection.send_result(msg["id"], result or {})
    except Exception as err:  # noqa: BLE001 - immer antworten, nie hängen
        _LOGGER.warning("PVM: Analyse fehlgeschlagen: %s", err)
        connection.send_error(msg["id"], "analysis_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/forecast_refresh"})
@websocket_api.async_response
async def ws_forecast_refresh(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Erzwingt sofort eine Prognose-Aktualisierung (z. B. nach
    Eintrag eines API-Schlüssels in den Einstellungen)."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    try:
        await manager.refresh_forecast_now()
        connection.send_result(
            msg["id"], getattr(manager, "forecast_data", None) or {}
        )
    except Exception as err:  # noqa: BLE001 - immer antworten, nie hängen
        _LOGGER.warning("PVM: Prognose-Refresh fehlgeschlagen: %s", err)
        connection.send_error(msg["id"], "forecast_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/control"})
@websocket_api.async_response
async def ws_control(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Steuert ein Gerät aus dem Panel (einziger, konsequent robuste Weg).

    ``kind`` ist einer von: dev_mode (auto/manual), on, off, start, stop,
    temp_ziel, limit. Gibt das Fehlerergebnis strukturiert zurück, damit
    die Seite eine verständliche Meldung zeigen kann – nie still hängen.
    """
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    try:
        result = await manager.device_control(msg.get("device_id"), msg)
        connection.send_result(msg["id"], result or {"ok": True})
    except Exception as err:  # noqa: BLE001 - immer antworten, nie hängen
        _LOGGER.warning("PVM: Steuerbefehl fehlgeschlagen: %s", err)
        connection.send_error(msg["id"], "control_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/energy_suggest"})
@websocket_api.async_response
async def ws_energy_suggest(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Schlägt Energie-Sensoren automatisch vor (Erkennung + Plausibilität)."""
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    try:
        result = await manager.suggest_energy_now(notify=False)
        connection.send_result(msg["id"], result or {})
    except Exception as err:  # noqa: BLE001 - immer antworten, nie hängen
        _LOGGER.warning("PVM: Energie-Vorschläge fehlgeschlagen: %s", err)
        connection.send_error(msg["id"], "suggest_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/reload"})
@websocket_api.async_response
async def ws_reload(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Lädt die Entitäten neu (nach Geräte-Änderungen) und antwortet erst,
    wenn der Reload abgeschlossen ist – die Seite wartet also nie vergeblich.
    """
    manager = _get_manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded")
        return
    entry_id = manager.entry.entry_id
    try:
        await hass.config_entries.async_reload(entry_id)
    except Exception as err:  # noqa: BLE001 - immer antworten, nie hängen
        _LOGGER.exception("PVM: Reload fehlgeschlagen")
        connection.send_error(msg["id"], "reload_failed", str(err))
        return
    fresh = _get_manager(hass)
    connection.send_result(
        msg["id"], {"ok": True, "instance": getattr(fresh, "instance_id", None)}
    )


async def async_register_websocket(hass: HomeAssistant) -> None:
    """Registriert alle PVM-WebSocket-Kommandos (einmalig)."""
    if f"{DOMAIN}_ws" in hass.data:
        return
    hass.data[f"{DOMAIN}_ws"] = True
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_save_config)
    websocket_api.async_register_command(hass, ws_scan)
    websocket_api.async_register_command(hass, ws_list_entities)
    websocket_api.async_register_command(hass, ws_forecast)
    websocket_api.async_register_command(hass, ws_analysis)
    websocket_api.async_register_command(hass, ws_forecast_refresh)
    websocket_api.async_register_command(hass, ws_control)
    websocket_api.async_register_command(hass, ws_energy_suggest)
    websocket_api.async_register_command(hass, ws_reload)
    _LOGGER.debug("PVM-WebSocket-Kommandos registriert")
