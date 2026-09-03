"""Verarbeitet zeitliche Ziele (Deadlines) und berechnet Startzeiten."""

from datetime import datetime, timedelta
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from .error_handler import ErrorHandler

class Scheduler:
    """Verwaltet zeitliche Ziele für Geräte."""

    def __init__(self, hass: HomeAssistant, error_handler: ErrorHandler):
        self.hass = hass
        self.error_handler = error_handler
        self._deadlines = {}

    async def async_set_deadline(self, device_id: str, target_time: datetime, target_value: float):
        """Setzt ein zeitliches Ziel für ein Gerät."""
        self._deadlines[device_id] = {
            "target_time": target_time,
            "target_value": target_value,
            "created_at": datetime.now()
        }
        self.error_handler.log_info(
            "Scheduler",
            f"Ziel für {device_id}: bis {target_time.strftime('%H:%M')} auf {target_value} kWh"
        )

    async def async_clear_deadline(self, device_id: str):
        """Löscht ein zeitliches Ziel."""
        if device_id in self._deadlines:
            del self._deadlines[device_id]
            self.error_handler.log_info("Scheduler", f"Ziel für {device_id} gelöscht")

    async def async_get_required_power(self, device_id: str, current_value: float) -> float:
        """Berechnet die benötigte Leistung, um das Ziel zu erreichen."""
        deadline = self._deadlines.get(device_id)
        if not deadline:
            return 0.0

        target_time = deadline["target_time"]
        target_value = deadline["target_value"]
        now = datetime.now()

        if now >= target_time:
            self.error_handler.log_warning("Scheduler", f"Deadline für {device_id} überschritten")
            return 0.0

        remaining_time = (target_time - now).total_seconds() / 3600  # Stunden
        remaining_energy = target_value - current_value

        if remaining_energy <= 0:
            return 0.0

        required_power = remaining_energy / remaining_time
        return max(0.0, required_power)

    def get_all_deadlines(self) -> dict:
        """Gibt alle aktiven Deadlines zurück."""
        return self._deadlines.copy()

    async def async_check_deadlines(self):
        """Prüft alle Deadlines und gibt Warnungen aus, wenn sie nicht erreichbar sind."""
        now = datetime.now()
        for device_id, deadline in self._deadlines.items():
            if now >= deadline["target_time"]:
                self.error_handler.log_warning(
                    "Scheduler",
                    f"Deadline für {device_id} überschritten! Ziel: {deadline['target_value']}"
                )
                # Benachrichtigung senden (optional)