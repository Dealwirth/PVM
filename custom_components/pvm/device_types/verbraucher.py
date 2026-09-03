"""Verbraucher-Gerätetyp (Waschmaschine, Lüftung, etc.)."""

from .base import BaseDevice

class VerbraucherDevice(BaseDevice):
    """Repräsentiert einen beliebigen Verbraucher."""

    def __init__(self, hass, device_id: str, name: str, **kwargs):
        super().__init__(hass, device_id, name, "verbraucher")
        self._max_power = kwargs.get("max_power", 2.0)  # Standard 2 kW
        self._min_power = kwargs.get("min_power", 0.5)  # Standard 0.5 kW

    async def async_get_power(self) -> float:
        """Aktuelle Leistungsaufnahme in kW."""
        # Platzhalter – später aus Sensor lesen
        return 0.0

    async def async_turn_on(self) -> bool:
        """Verbraucher einschalten."""
        self._status = "on"
        return True

    async def async_turn_off(self) -> bool:
        """Verbraucher ausschalten."""
        self._status = "off"
        return True

    async def async_set_power(self, value: float) -> bool:
        """Leistung setzen (falls regelbar)."""
        if value < self._min_power:
            value = 0
        elif value > self._max_power:
            value = self._max_power
        self._power = value
        return True

    async def async_update(self):
        """Aktualisiert den Zustand."""
        await super().async_update()