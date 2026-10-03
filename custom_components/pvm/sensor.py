"""Sensor platform exposing PVM summary values to Home Assistant."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfEnergy, UnitOfPower
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN


@dataclass(frozen=True)
class PvmSensorDescription(SensorEntityDescription):
    value_fn: Callable[[dict[str, Any]], Any] | None = None


SENSORS: tuple[PvmSensorDescription, ...] = (
    PvmSensorDescription(
        key="total_power",
        translation_key="total_power",
        native_unit_of_measurement=UnitOfPower.WATT,
        device_class=SensorDeviceClass.POWER,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: d.get("devices", {}).get("totalPowerW"),
    ),
    PvmSensorDescription(
        key="device_count",
        translation_key="device_count",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: d.get("devices", {}).get("total"),
    ),
    PvmSensorDescription(
        key="residual_energy",
        translation_key="residual_energy",
        native_unit_of_measurement=UnitOfEnergy.KILO_WATT_HOUR,
        device_class=SensorDeviceClass.ENERGY,
        state_class=SensorStateClass.TOTAL,
        value_fn=lambda d: round((d.get("forecast", {}).get("totalResidualWh") or 0) / 1000, 2)
        if d.get("forecast")
        else None,
    ),
    PvmSensorDescription(
        key="production_energy",
        translation_key="production_energy",
        native_unit_of_measurement=UnitOfEnergy.KILO_WATT_HOUR,
        device_class=SensorDeviceClass.ENERGY,
        state_class=SensorStateClass.TOTAL,
        value_fn=lambda d: round((d.get("forecast", {}).get("totalProductionWh") or 0) / 1000, 2)
        if d.get("forecast")
        else None,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(PvmSensor(coordinator, entry.entry_id, desc) for desc in SENSORS)


class PvmSensor(CoordinatorEntity, SensorEntity):
    """A sensor backed by a PVM dashboard field."""

    _attr_has_entity_name = True
    entity_description: PvmSensorDescription

    def __init__(self, coordinator, entry_id: str, description: PvmSensorDescription) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{DOMAIN}_{entry_id}_{description.key}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry_id)},
            "name": "PVM",
            "manufacturer": "PVM",
            "model": "PV-Manager",
        }

    @property
    def native_value(self) -> Any:
        if not self.coordinator.data:
            return None
        return self.entity_description.value_fn(self.coordinator.data)
