"""Initialisierung der PVM-Integration."""

import asyncio
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED

from .const import DOMAIN, MAX_CONSECUTIVE_ERRORS
from .logic.error_handler import ErrorHandler
from .logic.priority_engine import PriorityEngine
from .logic.auto_detector import AutoDetector
from .logic.scheduler import Scheduler
from .logic.wp_calibration import WpCalibration
from .logic.test_runner import TestRunner
from .device_types.registry import DeviceRegistry
from .dashboard.dashboard_creator import DashboardCreator
from .services import async_setup_services

PLATFORMS = ["sensor", "switch"]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up PVM from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    error_handler = ErrorHandler(hass)
    registry = DeviceRegistry(hass)

    # Initialisiere AutoDetector
    auto_detector = AutoDetector(hass, registry, error_handler)
    await auto_detector.async_initialize()

    # Initialisiere Scheduler
    scheduler = Scheduler(hass, error_handler)

    # Initialisiere WP-Calibration (Gerüst)
    wp_calibration = WpCalibration(hass, error_handler)

    # Initialisiere Test-Runner (Gerüst)
    test_runner = TestRunner(hass, error_handler)

    # Initialisiere PriorityEngine
    engine = PriorityEngine(hass, registry, error_handler, auto_detector)
    hass.data[DOMAIN]["engine"] = engine
    hass.data[DOMAIN]["registry"] = registry
    hass.data[DOMAIN]["auto_detector"] = auto_detector
    hass.data[DOMAIN]["scheduler"] = scheduler
    hass.data[DOMAIN]["wp_calibration"] = wp_calibration
    hass.data[DOMAIN]["test_runner"] = test_runner
    hass.data[DOMAIN]["entry_id"] = entry.entry_id

    # Dashboard erstellen (falls noch nicht vorhanden)
    dashboard_creator = DashboardCreator(hass, error_handler)
    await dashboard_creator.async_create_dashboard()

    # Services registrieren
    await async_setup_services(hass)

    # Forward setup to platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Starte Engine nach HA-Start
    async def start_engine(event):
        await engine.async_start()
    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, start_engine)

    entry.async_on_unload(entry.add_update_listener(async_update_entry))
    return True

async def async_update_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Update listener for config entry."""
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    engine = hass.data[DOMAIN].get("engine")
    if engine:
        await engine.async_stop()
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data.pop(DOMAIN, None)
    return unload_ok