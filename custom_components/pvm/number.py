"""Nummern-Entitäten für PVM (Reserve, Zeiten + Geräte-Ziele)."""

from __future__ import annotations

import logging

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DEFAULT_CYCLE_S,
    DEFAULT_MIN_OFF_S,
    DEFAULT_MIN_ON_S,
    DOMAIN,
    ENTITY_LABELS,
    ROLE_FAHRZEUG,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
)
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)

# Geräte-Nummern je Rolle: (Schlüssel, Pfad, min, max, step, Einheit)
DEVICE_NUMBERS = {
    ROLE_WALLBOX: [
        ("min_soc", "car.min_soc", 0.0, 100.0, 1.0, "%"),
        ("max_soc", "car.max_soc", 10.0, 100.0, 1.0, "%"),
        ("deadline_soc", "car.deadline_soc", 0.0, 100.0, 1.0, "%"),
        ("power_limit", "limits.power_limit_w", 500.0, 22000.0, 100.0, "W"),
        ("min_on_power", "limits.min_on_power_w", 100.0, 11000.0, 100.0, "W"),
    ],
    ROLE_FAHRZEUG: [
        # Auto & Wallbox sind getrennt: Die Lade-Ziele gehören zum Auto –
        # deshalb gibt es sie auch als Entitäten am Auto-Gerät (Automationen).
        ("min_soc", "car.min_soc", 0.0, 100.0, 1.0, "%"),
        ("max_soc", "car.max_soc", 10.0, 100.0, 1.0, "%"),
        ("deadline_soc", "car.deadline_soc", 0.0, 100.0, 1.0, "%"),
    ],
    ROLE_WAERMEPUMPE: [
        ("comfort", "wp.comfort_c", 40.0, 70.0, 0.5, "°C"),
        ("safety", "wp.safety_min_c", 20.0, 50.0, 1.0, "°C"),
    ],
    ROLE_VERBRAUCHER: [
        ("nominal", "limits.nominal_power_w", 50.0, 22000.0, 100.0, "W"),
    ],
}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Richtet die Nummern-Entitäten ein."""
    manager: PvmManager = hass.data[DOMAIN][entry.entry_id]
    entities: list[NumberEntity] = [
        PvmReserveNumber(manager),
        PvmCycleNumber(manager),
        PvmMinOnNumber(manager),
        PvmMinOffNumber(manager),
    ]
    for device in manager.config.get("devices", []):
        for kind, path, lo, hi, step, unit in DEVICE_NUMBERS.get(
            device.get("role"), []
        ):
            entities.append(
                PvmDeviceNumber(manager, device["id"], kind, path, lo, hi, step, unit)
            )
    async_add_entities(entities)


class PvmNumber(NumberEntity):
    """Basis mit Manager-Subscription."""

    _attr_should_poll = False
    _attr_mode = NumberMode.SLIDER

    def __init__(self, manager: PvmManager) -> None:
        super().__init__()
        self.manager = manager
        self._unsub = manager.subscribe(self._refresh)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        self._unsub()
        await super().async_will_remove_from_hass()

    def _refresh(self) -> None:
        try:
            self.async_write_ha_state()
        except Exception:  # noqa: BLE001
            _LOGGER.debug("Nummern-Update fehlgeschlagen", exc_info=True)


class PvmReserveNumber(PvmNumber):
    """Einspeise-Reserve (Watt), die nie an Verbraucher geht."""

    _attr_has_entity_name = True
    _attr_translation_key = "reserve"
    _attr_native_min_value = 0.0
    _attr_native_max_value = 2000.0
    _attr_native_step = 10.0
    _attr_native_unit_of_measurement = "W"
    _attr_unique_id = f"{DOMAIN}_reserve"

    @property
    def native_value(self) -> float:
        return float(self.manager.config.get("settings", {}).get("reserve_w", 0))

    async def async_set_native_value(self, value: float) -> None:
        self.manager.set_setting("reserve_w", float(value))
        self.async_write_ha_state()


class _PvmSettingNumber(PvmNumber):
    """Globale Zahlen-Einstellung (direkt im Store, ohne Umrechnung)."""

    _attr_has_entity_name = True

    def __init__(
        self,
        manager: PvmManager,
        translation_key: str,
        unique_suffix: str,
        config_key: str,
        lo: float,
        hi: float,
        step: float,
        unit: str,
        default: float,
    ) -> None:
        super().__init__(manager)
        self._attr_translation_key = translation_key
        self._attr_unique_id = f"{DOMAIN}_{unique_suffix}"
        self._attr_native_min_value = lo
        self._attr_native_max_value = hi
        self._attr_native_step = step
        self._attr_native_unit_of_measurement = unit
        self._config_key = config_key
        self._default = default

    @property
    def native_value(self) -> float:
        return float(
            self.manager.config.get("settings", {}).get(self._config_key, self._default)
        )

    async def async_set_native_value(self, value: float) -> None:
        self.manager.set_setting(self._config_key, float(value))
        self.async_write_ha_state()


class PvmCycleNumber(_PvmSettingNumber):
    """Zykluszeit: wie oft PVM neu entscheidet."""

    def __init__(self, manager: PvmManager) -> None:
        super().__init__(
            manager,
            translation_key="cycle",
            unique_suffix="cycle",
            config_key="cycle_s",
            lo=10.0,
            hi=300.0,
            step=5.0,
            unit="s",
            default=DEFAULT_CYCLE_S,
        )


class PvmMinOnNumber(_PvmSettingNumber):
    """Mindest-Einschaltdauer (Antiflackern)."""

    def __init__(self, manager: PvmManager) -> None:
        super().__init__(
            manager,
            translation_key="min_on",
            unique_suffix="min_on",
            config_key="min_on_s",
            lo=30.0,
            hi=600.0,
            step=10.0,
            unit="s",
            default=DEFAULT_MIN_ON_S,
        )


class PvmMinOffNumber(_PvmSettingNumber):
    """Mindest-Ausschaltdauer (Antiflackern)."""

    def __init__(self, manager: PvmManager) -> None:
        super().__init__(
            manager,
            translation_key="min_off",
            unique_suffix="min_off",
            config_key="min_off_s",
            lo=10.0,
            hi=300.0,
            step=5.0,
            unit="s",
            default=DEFAULT_MIN_OFF_S,
        )


class PvmDeviceNumber(PvmNumber):
    """Zahlwert eines Geräts (z. B. Mindest-/Max-SOC, Soll-Temperatur)."""

    def __init__(
        self,
        manager: PvmManager,
        device_id: str,
        kind: str,
        path: str,
        lo: float,
        hi: float,
        step: float,
        unit: str,
    ) -> None:
        super().__init__(manager)
        self.device_id = device_id
        self.kind = kind
        self.path = path
        self._attr_native_min_value = lo
        self._attr_native_max_value = hi
        self._attr_native_step = step
        self._attr_native_unit_of_measurement = unit
        self._attr_unique_id = f"{DOMAIN}_{kind}_{self.device_id}"
        device = manager.get_device(device_id) or {}
        self._attr_name = (
            f"{device.get('name', 'Gerät')} – {ENTITY_LABELS.get(kind, kind)}"
        )

    @property
    def native_value(self) -> float:
        device = self.manager.get_device(self.device_id) or {}
        value: object = device
        for part in self.path.split("."):
            value = value.get(part, 0.0) if isinstance(value, dict) else 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(self._attr_native_min_value)

    async def async_set_native_value(self, value: float) -> None:
        self.manager.set_device_flag(self.device_id, self.path, float(value))
        self.async_write_ha_state()
