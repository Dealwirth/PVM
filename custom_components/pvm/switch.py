"""Schalter für Power Charge, WP-Test, etc."""

from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from .const import DOMAIN
from .logic.error_handler import ErrorHandler

async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    async_add_entities: AddEntitiesCallback,
    discovery_info: DiscoveryInfoType = None,
):
    """Setup der Switch-Plattform."""
    error_handler = ErrorHandler(hass)
    switches = []

    registry = hass.data[DOMAIN].get("registry")
    if registry:
        wallboxes = registry.get_devices_by_type("wallbox")
        for wallbox in wallboxes:
            switches.append(PowerChargeSwitch(wallbox))

    async_add_entities(switches, True)
    error_handler.log_info("switch", f"{len(switches)} Schalter geladen")

class PowerChargeSwitch(SwitchEntity):
    """Schalter für Power Charge (volle Leistung)."""

    def __init__(self, device):
        self._device = device
        self._attr_name = f"Power Charge {device.name}"
        self._attr_unique_id = f"{device.device_id}_power_charge"
        self._attr_is_on = False

    @property
    def is_on(self):
        return self._attr_is_on

    async def async_turn_on(self, **kwargs):
        self._attr_is_on = True
        await self._device.async_set_power(self._device._max_power)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs):
        self._attr_is_on = False
        await self._device.async_turn_off()
        self.async_write_ha_state()

    async def async_update(self):
        await self._device.async_update()