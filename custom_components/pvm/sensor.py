"""Sensoren für PV, WP, Auto und Verbraucher."""

from homeassistant.components.sensor import SensorEntity, SensorDeviceClass
from homeassistant.const import UnitOfPower, UnitOfTemperature, PERCENTAGE
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from .const import DOMAIN, SENSOR_MAPPING
from .logic.error_handler import ErrorHandler


async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    async_add_entities: AddEntitiesCallback,
    discovery_info: DiscoveryInfoType = None,
):
    """Setup der Sensor-Plattform."""
    error_handler = ErrorHandler(hass)
    sensors = []

    # Sensoren aus der Registry erstellen
    registry = hass.data.get(DOMAIN, {}).get("registry")
    if registry:
        try:
            for device in registry.get_all_devices():
                if device.device_type == "pv":
                    sensors.append(PVSensor(device))
                elif device.device_type == "wp":
                    sensors.append(WPSensor(device))
                elif device.device_type == "auto":
                    sensors.append(CarSensor(device))
                elif device.device_type == "verbraucher":
                    sensors.append(ConsumerSensor(device))
        except Exception as e:
            error_handler.log_error("sensor", "Fehler beim Erstellen der Sensoren", e)

    if sensors:
        async_add_entities(sensors, True)
        error_handler.log_info("sensor", f"{len(sensors)} Sensoren geladen")
    else:
        error_handler.log_warning("sensor", "Keine Sensoren gefunden")

class PVSensor(SensorEntity):
    """Sensor für PV-Anlage."""

    def __init__(self, device):
        self._device = device
        self._attr_name = f"{device.name} Leistung"
        self._attr_unique_id = f"{device.device_id}_power"
        self._attr_device_class = SensorDeviceClass.POWER
        self._attr_native_unit_of_measurement = UnitOfPower.KILO_WATT

    @property
    def native_value(self):
        try:
            return self._device.power
        except Exception:
            return 0

    async def async_update(self):
        try:
            await self._device.async_update()
        except Exception:
            pass

class WPSensor(SensorEntity):
    """Sensor für Wärmepumpe."""

    def __init__(self, device):
        self._device = device
        self._attr_name = f"{device.name} Temperatur"
        self._attr_unique_id = f"{device.device_id}_temperature"
        self._attr_device_class = SensorDeviceClass.TEMPERATURE
        self._attr_native_unit_of_measurement = UnitOfTemperature.CELSIUS

    @property
    def native_value(self):
        try:
            return getattr(self._device, "temperature", 0)
        except Exception:
            return 0

    async def async_update(self):
        try:
            await self._device.async_update()
        except Exception:
            pass

class CarSensor(SensorEntity):
    """Sensor für Auto (SoC)."""

    def __init__(self, device):
        self._device = device
        self._attr_name = f"{device.name} SoC"
        self._attr_unique_id = f"{device.device_id}_soc"
        self._attr_device_class = SensorDeviceClass.BATTERY
        self._attr_native_unit_of_measurement = PERCENTAGE

    @property
    def native_value(self):
        try:
            return getattr(self._device, "soc", 0)
        except Exception:
            return 0

    async def async_update(self):
        try:
            await self._device.async_update()
        except Exception:
            pass

class ConsumerSensor(SensorEntity):
    """Sensor für Verbraucher."""

    def __init__(self, device):
        self._device = device
        self._attr_name = f"{device.name} Leistung"
        self._attr_unique_id = f"{device.device_id}_power"
        self._attr_device_class = SensorDeviceClass.POWER
        self._attr_native_unit_of_measurement = UnitOfPower.KILO_WATT

    @property
    def native_value(self):
        try:
            return self._device.power
        except Exception:
            return 0

    async def async_update(self):
        try:
            await self._device.async_update()
        except Exception:
            pass