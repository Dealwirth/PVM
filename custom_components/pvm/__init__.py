"""PVM – PV Manager: Einrichtung der Integration."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PLATFORMS
from .manager import PvmManager
from .panel import async_register_panel, async_unregister_panel
from .store import PvmStore
from .websocket import async_register_websocket

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Richtet PVM aus einem Config-Eintrag ein."""
    hass.data.setdefault(DOMAIN, {})
    manager = await PvmManager.async_create(hass, entry)
    hass.data[DOMAIN][entry.entry_id] = manager

    # Plattformen (Entitäten) zuerst, danach Engine
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await manager.async_start()

    await async_setup_services(hass)
    await async_register_websocket(hass)

    # Eigene Seitenleisten-Seite (ersetzt das Lovelace-Dashboard)
    await async_register_panel(hass, manager)

    entry.async_on_unload(entry.add_update_listener(async_update_entry))
    return True


async def async_update_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Wird bei Options-Änderungen aufgerufen (Reload)."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Entlädt PVM."""
    manager: PvmManager | None = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if manager is not None:
        await manager.async_stop()
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if not hass.data[DOMAIN]:
            hass.data.pop(DOMAIN, None)
    return unloaded


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Aufräumen, wenn die Integration komplett entfernt wird.

    Entfernt die eigene Seitenleisten-Seite (Dashboard), löscht die
    gespeicherte Konfiguration und räumt Benachrichtigungen auf –
    damit bleibt nach dem Löschen nichts von PVM zurück.
    """
    manager: PvmManager | None = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if manager is not None:
        await manager.async_stop()
        hass.data[DOMAIN].pop(entry.entry_id, None)

    # Eigene Seite aus der Seitenleiste entfernen (inkl. altem Dashboard)
    await async_unregister_panel(hass)

    # Gespeicherte Konfiguration löschen, damit nichts zurückbleibt.
    # Wichtig: Beim Löschen ist der Manager meist schon entladen (und aus
    # hass.data entfernt) – der Store wird deshalb direkt gelöscht, damit
    # garantiert nichts von PVM zurückbleibt.
    try:
        store = PvmStore(hass)
        await store.async_delete()
    except Exception:  # noqa: BLE001 - Aufräumen darf nie blockieren
        _LOGGER.debug("PVM: Konfigurationsdatei konnte nicht gelöscht werden", exc_info=True)
    if manager is not None:
        await manager.async_delete_storage()

    # Eigene Benachrichtigungen entfernen
    for notification_id in (
        f"{DOMAIN}_scan",
        f"{DOMAIN}_dashboard_ready",
        f"{DOMAIN}_dashboard",
        f"{DOMAIN}_self_test",
    ):
        try:
            await hass.services.async_call(
                "persistent_notification",
                "dismiss",
                {"notification_id": notification_id},
            )
        except Exception:  # noqa: BLE001 - Aufräumen darf nie blockieren
            _LOGGER.debug("PVM: Benachrichtigung konnte nicht entfernt werden", exc_info=True)


async def async_setup_services(hass: HomeAssistant) -> None:
    """Registriert die PVM-Services (einmalig pro HA-Lauf)."""
    if f"{DOMAIN}_services" in hass.data:
        return
    hass.data[f"{DOMAIN}_services"] = True
    from .services import async_register_services

    await async_register_services(hass)
