"""WP-Kalibrierung (Gerüst für spätere Implementierung)."""

from homeassistant.core import HomeAssistant
from .error_handler import ErrorHandler

class WpCalibration:
    """
    Führt den WP-Test durch (aktuell nur Gerüst).

    Diese Klasse ist für die spätere Implementierung der WP-Kalibrierung vorbereitet.
    Sie kann einen Testlauf starten, die Leistung messen und Störungen herausrechnen.
    """

    def __init__(self, hass: HomeAssistant, error_handler: ErrorHandler):
        self.hass = hass
        self.error_handler = error_handler
        self._is_running = False

    async def async_start_calibration(self, device_id: str, target_temp: float = 70) -> bool:
        """
        Startet die WP-Kalibrierung.

        Args:
            device_id: ID der Wärmepumpe
            target_temp: Zieltemperatur (Standard: 70 °C)

        Returns:
            True, wenn Test gestartet, sonst False
        """
        self.error_handler.log_info("WpCalibration", "WP-Kalibrierung gestartet (Gerüst)")
        self._is_running = True
        # Platzhalter – später implementieren
        return True

    async def async_stop_calibration(self) -> bool:
        """Stoppt die WP-Kalibrierung."""
        self.error_handler.log_info("WpCalibration", "WP-Kalibrierung gestoppt (Gerüst)")
        self._is_running = False
        return True

    async def async_get_results(self) -> dict:
        """Gibt die Ergebnisse der letzten Kalibrierung zurück."""
        return {
            "status": "not_implemented",
            "message": "WP-Kalibrierung ist als Gerüst vorbereitet, aber noch nicht implementiert.",
            "duration": 0,
            "energy": 0.0,
            "avg_power": 0.0,
            "max_power": 0.0,
            "min_power": 0.0,
            "start_temp": 0.0,
            "end_temp": 0.0,
            "disturbances": []
        }

    @property
    def is_running(self) -> bool:
        return self._is_running