"""Basisklasse für alle Gerätetypen."""

from abc import ABC, abstractmethod
from typing import Any, Optional

class BaseDevice(ABC):
    """Abstrakte Basisklasse für ein Gerät."""

    def __init__(self, hass, device_id: str, name: str, device_type: str):
        self.hass = hass
        self.device_id = device_id
        self.name = name
        self.device_type = device_type
        self._available = True
        self._power = 0.0
        self._status = "unknown"

    @property
    def available(self) -> bool:
        return self._available

    @property
    def power(self) -> float:
        return self._power

    @property
    def status(self) -> str:
        return self._status

    @abstractmethod
    async def async_get_power(self) -> float:
        """Aktuelle Leistungsaufnahme in kW."""
        pass

    @abstractmethod
    async def async_turn_on(self) -> bool:
        """Gerät einschalten."""
        pass

    @abstractmethod
    async def async_turn_off(self) -> bool:
        """Gerät ausschalten."""
        pass

    async def async_set_power(self, value: float) -> bool:
        """Leistung setzen (falls regelbar). Standard: nicht unterstützt."""
        return False

    async def async_update(self):
        """Aktualisiert den internen Zustand."""
        try:
            self._power = await self.async_get_power()
            self._available = True
        except Exception as e:
            self._available = False
            # Fehler wird vom Error-Handler behandelt

    def to_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "name": self.name,
            "type": self.device_type,
            "available": self._available,
            "power": self._power,
            "status": self._status,
        }