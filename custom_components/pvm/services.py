"""Service-Implementierungen für die PVM-Integration."""

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import entity_registry as er
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN
from .logic.error_handler import ErrorHandler

async def async_setup_services(hass: HomeAssistant):
    """Registriert alle Services."""
    error_handler = ErrorHandler(hass)

    async def handle_set_priority(call: ServiceCall):
        """Setzt die Priorität eines Geräts."""
        device_id = call.data.get("device_id")
        priority = call.data.get("priority")
        registry = hass.data[DOMAIN].get("registry")

        if not registry:
            raise HomeAssistantError("Registry nicht verfügbar")

        device = registry.get_device(device_id)
        if not device:
            raise HomeAssistantError(f"Gerät {device_id} nicht gefunden")

        # Priorität speichern (später in input_number)
        error_handler.log_info("services", f"Priorität für {device_id} auf {priority} gesetzt")
        # Platzhalter – später in input_number schreiben

    async def handle_power_charge(call: ServiceCall):
        """Startet Power Charge für ein Auto."""
        device_id = call.data.get("device_id")
        registry = hass.data[DOMAIN].get("registry")

        if not registry:
            raise HomeAssistantError("Registry nicht verfügbar")

        device = registry.get_device(device_id)
        if not device:
            raise HomeAssistantError(f"Gerät {device_id} nicht gefunden")

        if device.device_type != "wallbox":
            raise HomeAssistantError(f"Gerät {device_id} ist keine Wallbox")

        await device.async_set_power(device._max_power)
        error_handler.log_info("services", f"Power Charge für {device_id} gestartet")

    async def handle_set_deadline(call: ServiceCall):
        """Setzt ein zeitliches Ziel."""
        device_id = call.data.get("device_id")
        target_time = call.data.get("target_time")
        target_value = call.data.get("target_value")

        scheduler = hass.data[DOMAIN].get("scheduler")
        if not scheduler:
            raise HomeAssistantError("Scheduler nicht verfügbar")

        # target_time als datetime parsen
        from datetime import datetime
        try:
            target_dt = datetime.strptime(target_time, "%H:%M")
            # Aktuelles Datum + Zielzeit
            now = datetime.now()
            target_dt = target_dt.replace(year=now.year, month=now.month, day=now.day)
            if target_dt < now:
                # Wenn die Zeit heute schon vorbei ist, auf morgen setzen
                target_dt = target_dt + timedelta(days=1)
        except ValueError:
            raise HomeAssistantError(f"Ungültiges Zeitformat: {target_time}. Erwartet: HH:MM")

        await scheduler.async_set_deadline(device_id, target_dt, float(target_value))
        error_handler.log_info("services", f"Deadline für {device_id} gesetzt: {target_time}")

    async def handle_clear_deadline(call: ServiceCall):
        """Löscht ein zeitliches Ziel."""
        device_id = call.data.get("device_id")
        scheduler = hass.data[DOMAIN].get("scheduler")

        if not scheduler:
            raise HomeAssistantError("Scheduler nicht verfügbar")

        await scheduler.async_clear_deadline(device_id)
        error_handler.log_info("services", f"Deadline für {device_id} gelöscht")

    async def handle_scan_devices(call: ServiceCall):
        """Startet die automatische Geräteerkennung."""
        auto_detector = hass.data[DOMAIN].get("auto_detector")
        if not auto_detector:
            raise HomeAssistantError("AutoDetector nicht verfügbar")

        await auto_detector.async_detect()
        error_handler.log_info("services", "Gerätescan abgeschlossen")

    # Services registrieren
    hass.services.async_register(
        DOMAIN, "set_priority", handle_set_priority,
        schema=vol.Schema({
            vol.Required("device_id"): str,
            vol.Required("priority"): vol.All(int, vol.Range(min=1, max=10))
        })
    )

    hass.services.async_register(
        DOMAIN, "power_charge", handle_power_charge,
        schema=vol.Schema({
            vol.Required("device_id"): str
        })
    )

    hass.services.async_register(
        DOMAIN, "set_deadline", handle_set_deadline,
        schema=vol.Schema({
            vol.Required("device_id"): str,
            vol.Required("target_time"): str,
            vol.Required("target_value"): vol.All(float, vol.Range(min=1, max=100))
        })
    )

    hass.services.async_register(
        DOMAIN, "clear_deadline", handle_clear_deadline,
        schema=vol.Schema({
            vol.Required("device_id"): str
        })
    )

    hass.services.async_register(
        DOMAIN, "scan_devices", handle_scan_devices,
        schema=vol.Schema({})
    )

    error_handler.log_info("services", "Alle Services registriert")
async def handle_run_diagnostics(call: ServiceCall):
    """Führt die Diagnose durch und gibt das Ergebnis aus."""
    from .diagnostics import PVMDiagnostics
    diag = PVMDiagnostics(hass)
    result = await diag.async_run_diagnostics()
    
    # Fehler als Error melden
    if result["errors"]:
        for error in result["errors"]:
            error_handler.log_error("Diagnostics", error)
    # Warnungen als Warnung melden
    if result["warnings"]:
        for warning in result["warnings"]:
            error_handler.log_warning("Diagnostics", warning)
    # Infos als Info melden
    if result["infos"]:
        for info in result["infos"]:
            error_handler.log_info("Diagnostics", info)
    
    # Zusammenfassung als Benachrichtigung
    hass.components.persistent_notification.async_create(
        result["summary"],
        title="PVM Diagnose-Ergebnis",
        notification_id="pvm_diagnostic"
    )
    
    return result