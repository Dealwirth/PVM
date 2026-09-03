"""Auto-Gerätetyp."""

from .base import BaseDevice

class AutoDevice(BaseDevice):
    """Repräsentiert ein Auto (E-Auto)."""

    def __init__(self, hass, device_id: str, name: str, **kwargs):
        super().__init__(hass, device_id, name, "auto")
        self._battery_size = kwargs.get("battery_size", 70.0)  # kWh
        self._mindest_kwh = kwargs.get("mindest_kwh", 10.0)   # kWh
        self._max_soc = kwargs.get("max_soc", 80)             # Prozent
        self._soc = kwargs.get("soc", 0)                      # Prozent

    async def async_get_power(self) -> float:
        """Ladeleistung in kW."""
        # Platzhalter – später aus Sensor lesen
        return 0.0

    async def async_turn_on(self) -> bool:
        """Auto laden (über zugeordnete Wallbox)."""
        self._status = "loading"
        return True

    async def async_turn_off(self) -> bool:
        """Auto nicht laden."""
        self._status = "off"
        return True

    async def async_set_power(self, value: float) -> bool:
        """Ladeleistung setzen (über zugeordnete Wallbox)."""
        self._power = value
        return True

    async def async_update(self):
        """Aktualisiert den SoC."""
        # Platzhalter – später aus Sensor lesen
        await super().async_update()

    @property
    def soc(self) -> int:
        return self._soc

    @property
    def battery_size(self) -> float:
        return self._battery_size

    @property
    def mindest_kwh(self) -> float:
        return self._mindest_kwh

    @property
    def max_soc(self) -> int:
        return self._max_soc