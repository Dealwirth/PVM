"""Test-Runner für Verbraucher (Gerüst für spätere Implementierung)."""

from homeassistant.core import HomeAssistant
from .error_handler import ErrorHandler

class TestRunner:
    """
    Führt Tests für Verbraucher durch (aktuell nur Gerüst).

    Diese Klasse ist für die spätere Implementierung von Verbraucher-Tests vorbereitet.
    Sie kann ein Gerät einschalten, die Leistung messen und den Verbrauch berechnen.
    """

    def __init__(self, hass: HomeAssistant, error_handler: ErrorHandler):
        self.hass = hass
        self.error_handler = error_handler
        self._is_running = False
        self._results = {}

    async def async_start_test(self, device_id: str, duration_minutes: int = 10) -> bool:
        """
        Startet einen Test für einen Verbraucher.

        Args:
            device_id: ID des Geräts
            duration_minutes: Dauer des Tests (Standard: 10 Minuten)

        Returns:
            True, wenn Test gestartet, sonst False
        """
        self.error_handler.log_info("TestRunner", f"Test für {device_id} gestartet (Gerüst)")
        self._is_running = True
        # Platzhalter – später implementieren
        return True

    async def async_stop_test(self) -> bool:
        """Stoppt den aktuellen Test."""
        self.error_handler.log_info("TestRunner", "Test gestoppt (Gerüst)")
        self._is_running = False
        return True

    async def async_get_results(self, device_id: str) -> dict:
        """Gibt die Ergebnisse des letzten Tests zurück."""
        return {
            "status": "not_implemented",
            "message": "Test-Runner ist als Gerüst vorbereitet, aber noch nicht implementiert.",
            "device_id": device_id,
            "duration": 0,
            "avg_power": 0.0,
            "max_power": 0.0,
            "min_power": 0.0,
            "energy": 0.0,
            "disturbances": []
        }

    @property
    def is_running(self) -> bool:
        return self._is_running