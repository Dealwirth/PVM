"""PVM – PV Manager: Einrichtung der Integration."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PLATFORMS
from .dashboard_creator import schedule_dashboard_creation
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Richtet PVM aus einem Config-Eintrag ein."""
    hass.data.setdefault(DOMAIN, {})
    manager = await PvmManager.async_create(hass, entry)
    hass.data[DOMAIN][entry.entry_id] = manager

    # Plattformen (Entitäten) zuerst, danach Engine + Dashboard
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await manager.async_start()

    await async_setup_services(hass)
    schedule_dashboard_creation(manager)

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
    """Aufräumen, wenn die Integration komplett entfernt wird."""
    # Konfigurationsdaten liegen in einem eigenen Store, der mit entfernt wird,
    # sobald der letzte Config-Eintrag weg ist (Single-Instance-Integration).
    manager: PvmManager | None = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if manager is not None:
        await manager.async_stop()
        hass.data[DOMAIN].pop(entry.entry_id, None)


async def async_setup_services(hass: HomeAssistant) -> None:
    """Registriert die PVM-Services (einmalig pro HA-Lauf)."""
    if f"{DOMAIN}_services" in hass.data:
        return
    hass.data[f"{DOMAIN}_services"] = True
    from .services import async_register_services

    await async_register_services(hass)
