"""Wallbox-Gerätetyp."""

from .base import BaseDevice

class WallboxDevice(BaseDevice):
    """Repräsentiert eine Wallbox."""

    def __init__(self, hass, device_id: str, name: str, **kwargs):
        super().__init__(hass, device_id, name, "wallbox")
        self._max_power = kwargs.get("max_power", 11.0)  # Standard 11 kW
        self._min_power = kwargs.get("min_power", 1.4)   # Standard 1.4 kW
        self._auto_id = kwargs.get("auto_id")

    async def async_get_power(self) -> float:
        """Aktuelle Ladeleistung in kW."""
        # Platzhalter – später aus Sensor lesen
        return 0.0

    async def async_turn_on(self) -> bool:
        """Wallbox einschalten."""
        # Platzhalter – später Schalter setzen
        self._status = "on"
        return True

    async def async_turn_off(self) -> bool:
        """Wallbox ausschalten."""
        # Platzhalter – später Schalter setzen
        self._status = "off"
        return True

    async def async_set_power(self, value: float) -> bool:
        """Ladeleistung setzen."""
        if value < self._min_power:
            value = 0
        elif value > self._max_power:
            value = self._max_power
        # Platzhalter – später Leistung setzen
        self._power = value
        return True

    def set_auto_id(self, auto_id: str):
        """Setzt die ID des zugeordneten Autos."""
        self._auto_id = auto_id

    @property
    def auto_id(self) -> str:
        return self._auto_id