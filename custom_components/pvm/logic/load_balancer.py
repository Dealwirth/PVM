"""Verteilt die verfügbare Leistung auf die aktiven Geräte."""

from homeassistant.core import HomeAssistant
from ..device_types.registry import DeviceRegistry
from .error_handler import ErrorHandler

class LoadBalancer:
    """Verteilt die verfügbare Leistung basierend auf Bedarf und Priorität."""

    def __init__(self, hass: HomeAssistant, registry: DeviceRegistry,
                 error_handler: ErrorHandler):
        self.hass = hass
        self.registry = registry
        self.error_handler = error_handler

    async def async_distribute(self, available_power: float, priority_list: list) -> dict:
        """
        Verteilt die Leistung auf die Geräte.

        Args:
            available_power: Verfügbare Leistung in kW
            priority_list: Liste der Geräte-IDs in Prioritätsreihenfolge

        Returns:
            Dict mit device_id → zugewiesene Leistung
        """
        result = {}
        remaining_power = available_power

        for device_id in priority_list:
            device = self.registry.get_device(device_id)
            if not device or not device.available:
                continue

            # Bedarf des Geräts ermitteln
            demand = await self._get_demand(device)
            if demand <= 0:
                result[device_id] = 0
                continue

            # Leistung zuweisen
            power = min(demand, remaining_power)
            if power > 0:
                await device.async_set_power(power)
                result[device_id] = power
                remaining_power -= power
            else:
                await device.async_turn_off()
                result[device_id] = 0

            if remaining_power <= 0:
                # Alle restlichen Geräte ausschalten
                for remaining_id in priority_list[priority_list.index(device_id) + 1:]:
                    dev = self.registry.get_device(remaining_id)
                    if dev:
                        await dev.async_turn_off()
                        result[remaining_id] = 0
                break

        self.error_handler.log_info(
            "LoadBalancer",
            f"Verteilt: {len([v for v in result.values() if v > 0])} Geräte aktiv"
        )
        return result

    async def _get_demand(self, device) -> float:
        """Ermittelt den aktuellen Leistungsbedarf eines Geräts."""
        # Platzhalter – später aus Gerät abfragen
        # Wallboxen: Bedarf = Max-Leistung - aktuelle Leistung
        # WP: Bedarf = Leistung für Solltemperatur
        return 1.0