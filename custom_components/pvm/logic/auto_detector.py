"""Erkennt automatisch, welches Auto an welcher Wallbox hängt."""

from homeassistant.core import HomeAssistant
from .error_handler import ErrorHandler
from ..device_types.registry import DeviceRegistry

class AutoDetector:
    """Erkennt und speichert die Zuordnung von Wallbox zu Auto."""

    def __init__(self, hass: HomeAssistant, registry: DeviceRegistry,
                 error_handler: ErrorHandler):
        self.hass = hass
        self.registry = registry
        self.error_handler = error_handler
        self._mapping = {}

    async def async_initialize(self):
        """Initialisiert den AutoDetector."""
        self.error_handler.log_info("AutoDetector", "Initialisiert")

    async def async_detect(self):
        """Führt die automatische Erkennung durch."""
        wallboxes = self.registry.get_devices_by_type("wallbox")
        autos = self.registry.get_devices_by_type("auto")

        if not wallboxes or not autos:
            return

        for wallbox in wallboxes:
            try:
                wallbox_power = await wallbox.async_get_power()
                if wallbox_power > 0.1:  # Wallbox lädt
                    for auto in autos:
                        # Prüfe, ob das Auto lädt (SoC steigt)
                        old_soc = getattr(auto, "_old_soc", 0)
                        current_soc = getattr(auto, "soc", 0)
                        if current_soc > old_soc + 0.5:  # SoC ist gestiegen
                            self._mapping[wallbox.device_id] = auto.device_id
                            self.error_handler.log_info(
                                "AutoDetector",
                                f"Auto {auto.name} erkannt an Wallbox {wallbox.name}"
                            )
                            break
                        auto._old_soc = current_soc
            except Exception as e:
                self.error_handler.log_warning("AutoDetector", f"Fehler bei Wallbox {wallbox.device_id}: {e}")

    def get_auto_for_wallbox(self, wallbox_id: str) -> str:
        """Gibt die Auto-ID für eine Wallbox zurück."""
        return self._mapping.get(wallbox_id)

    async def async_manual_mapping(self, wallbox_id: str, auto_id: str):
        """Erlaubt manuelle Zuordnung durch den Benutzer."""
        self._mapping[wallbox_id] = auto_id
        self.error_handler.log_info(
            "AutoDetector",
            f"Manuelle Zuordnung: Wallbox {wallbox_id} → Auto {auto_id}"
        )