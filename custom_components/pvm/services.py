"""Service-Implementierungen für die PVM-Integration."""

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .logic.error_handler import ErrorHandler
from .diagnostics import PVMDiagnostics


async def async_setup_services(hass: HomeAssistant):
    """Registriert alle Services."""
    error_handler = ErrorHandler(hass)

    # ... (deine anderen Service-Funktionen hier) ...

    async def handle_run_diagnostics(call: ServiceCall):
        """Führt die Diagnose durch und gibt das Ergebnis aus."""
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

    # Service registrieren
    hass.services.async_register(
        DOMAIN, "run_diagnostics", handle_run_diagnostics,
        schema=vol.Schema({})
    )

    error_handler.log_info("services", "Diagnose-Service registriert")