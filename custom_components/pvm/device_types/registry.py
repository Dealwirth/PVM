"""Registry für alle Gerätetypen."""

from typing import Dict, Type
from homeassistant.core import HomeAssistant
from .base import BaseDevice
from .wallbox import WallboxDevice
from .waermepumpe import WaermepumpeDevice
from .verbraucher import VerbraucherDevice
from .auto import AutoDevice

class DeviceRegistry:
    """Zentrale Registry für alle Gerätetypen."""

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self._devices: Dict[str, BaseDevice] = {}
        self._device_classes: Dict[str, Type[BaseDevice]] = {
            "wallbox": WallboxDevice,
            "waermepumpe": WaermepumpeDevice,
            "verbraucher": VerbraucherDevice,
            "auto": AutoDevice,
        }

    def register_device(self, device: BaseDevice):
        """Registriert ein Gerät in der Registry."""
        self._devices[device.device_id] = device

    def unregister_device(self, device_id: str):
        """Entfernt ein Gerät aus der Registry."""
        if device_id in self._devices:
            del self._devices[device_id]

    def get_device(self, device_id: str) -> BaseDevice:
        """Gibt ein Gerät anhand seiner ID zurück."""
        return self._devices.get(device_id)

    def get_devices_by_type(self, device_type: str) -> list:
        """Gibt alle Geräte eines bestimmten Typs zurück."""
        return [d for d in self._devices.values() if d.device_type == device_type]

    def get_all_devices(self) -> list:
        """Gibt alle registrierten Geräte zurück."""
        return list(self._devices.values())

    def create_device(self, device_type: str, device_id: str, name: str, **kwargs) -> BaseDevice:
        """Erstellt ein neues Gerät anhand des Typs."""
        device_class = self._device_classes.get(device_type)
        if not device_class:
            raise ValueError(f"Unbekannter Gerätetyp: {device_type}")
        return device_class(self.hass, device_id, name, **kwargs)

    @property
    def device_count(self) -> int:
        return len(self._devices)