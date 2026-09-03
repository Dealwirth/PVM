"""Wärmepumpen-Gerätetyp."""

from .base import BaseDevice

class WaermepumpeDevice(BaseDevice):
    """Repräsentiert eine Wärmepumpe."""

    def __init__(self, hass, device_id: str, name: str, **kwargs):
        super().__init__(hass, device_id, name, "waermepumpe")
        self._soll_temperatur = kwargs.get("soll_temperatur", 60)
        self._ist_temperatur = kwargs.get("ist_temperatur", 0)

    async def async_get_power(self) -> float:
        """Aktuelle Leistungsaufnahme in kW."""
        # Platzhalter – später aus Sensor lesen
        return 0.0

    async def async_turn_on(self) -> bool:
        """Wärmepumpe einschalten (Solltemperatur erhöhen)."""
        self._status = "on"
        await self.async_set_soll_temperatur(70)
        return True

    async def async_turn_off(self) -> bool:
        """Wärmepumpe ausschalten (Solltemperatur senken)."""
        self._status = "off"
        await self.async_set_soll_temperatur(60)
        return True

    async def async_set_soll_temperatur(self, value: float):
        """Setzt die Solltemperatur."""
        self._soll_temperatur = value
        # Platzhalter – später Wert an WP senden

    async def async_update(self):
        """Aktualisiert die Ist-Temperatur."""
        # Platzhalter – später aus Sensor lesen
        await super().async_update()

    @property
    def temperature(self) -> float:
        return self._ist_temperatur

    @property
    def soll_temperatur(self) -> float:
        return self._soll_temperatur