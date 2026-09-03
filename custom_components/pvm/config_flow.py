"""Setup-Wizard für die PVM-Integration."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN, DEFAULT_PRIORITIES
from .logic.error_handler import ErrorHandler
from .device_types.registry import DeviceRegistry
from .logic.auto_detector import AutoDetector
from .dashboard.dashboard_creator import DashboardCreator


class PVMConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config Flow für PVM."""

    VERSION = 1

    def __init__(self):
        self._devices = {}
        self._auto_mapping = {}

    async def async_step_user(self, user_input=None):
        """Erster Schritt: Begrüßung und Geräteerkennung."""
        if user_input is not None:
            return await self.async_step_devices()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({}),
            description_placeholders={
                "description": "PVM – PV Manager hilft dir, deinen PV-Überschuss intelligent zu verteilen."
            }
        )

    async def async_step_devices(self, user_input=None):
        """Zweiter Schritt: Geräte automatisch erkennen."""
        error_handler = ErrorHandler(self.hass)
        registry = DeviceRegistry(self.hass)
        auto_detector = AutoDetector(self.hass, registry, error_handler)

        # Geräte erkennen
        await auto_detector.async_initialize()
        await auto_detector.async_detect()

        # Gefundene Geräte anzeigen
        devices = registry.get_all_devices()
        device_options = {d.device_id: f"{d.name} ({d.device_type})" for d in devices}

        if user_input is not None:
            # Auswahl speichern
            self._devices = user_input.get("devices", [])
            return await self.async_step_autos()

        return self.async_show_form(
            step_id="devices",
            data_schema=vol.Schema({
                vol.Required("devices", default=[]): vol.All(
                    [vol.In(device_options.keys())],
                    vol.Length(min=1, msg="Wähle mindestens ein Gerät aus")
                )
            }),
            description_placeholders={
                "device_options": "\n".join([f"- {v}" for v in device_options.values()])
            }
        )

    async def async_step_autos(self, user_input=None):
        """Dritter Schritt: Autos konfigurieren."""
        if user_input is not None:
            # Autos speichern
            return await self.async_step_priorities()

        return self.async_show_form(
            step_id="autos",
            data_schema=vol.Schema({
                vol.Required("auto1_name", default="Auto 1"): str,
                vol.Required("auto1_battery", default=70): vol.All(int, vol.Range(min=10, max=120)),
                vol.Required("auto1_mindest_kwh", default=10.0): vol.All(float, vol.Range(min=1, max=50)),
                vol.Required("auto1_max_soc", default=80): vol.All(int, vol.Range(min=50, max=100)),
                vol.Required("auto2_name", default="Auto 2"): str,
                vol.Required("auto2_battery", default=70): vol.All(int, vol.Range(min=10, max=120)),
                vol.Required("auto2_mindest_kwh", default=10.0): vol.All(float, vol.Range(min=1, max=50)),
                vol.Required("auto2_max_soc", default=80): vol.All(int, vol.Range(min=50, max=100)),
            })
        )

    async def async_step_priorities(self, user_input=None):
        """Vierter Schritt: Prioritätenliste (Drag & Drop)."""
        if user_input is not None:
            # Dashboard erstellen
            error_handler = ErrorHandler(self.hass)
            dashboard_creator = DashboardCreator(self.hass, error_handler)
            await dashboard_creator.async_create_dashboard()

            return self.async_create_entry(
                title="PV Manager",
                data={
                    "devices": self._devices,
                    "priorities": user_input.get("priorities", DEFAULT_PRIORITIES)
                }
            )

        return self.async_show_form(
            step_id="priorities",
            data_schema=vol.Schema({}),
            description_placeholders={
                "info": "Hier kannst du später im Dashboard die Prioritäten per Drag & Drop festlegen."
            }
        )