"""Kernentscheidung: Wer bekommt wie viel Strom? (Prioritätenliste)"""

import asyncio
from homeassistant.core import HomeAssistant
from .error_handler import ErrorHandler
from .auto_detector import AutoDetector
from ..device_types.registry import DeviceRegistry
from ..const import MAX_CONSECUTIVE_ERRORS

class PriorityEngine:
    """Verteilt die verfügbare Leistung basierend auf Prioritäten."""

    def __init__(self, hass: HomeAssistant, registry: DeviceRegistry,
                 error_handler: ErrorHandler, auto_detector: AutoDetector):
        self.hass = hass
        self.registry = registry
        self.error_handler = error_handler
        self.auto_detector = auto_detector
        self._running = False
        self._task = None

    async def async_start(self):
        """Startet die Engine."""
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        self.error_handler.log_info("PriorityEngine", "Engine gestartet")

    async def async_stop(self):
        """Stoppt die Engine."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self.error_handler.log_info("PriorityEngine", "Engine gestoppt")

    async def _run_loop(self):
        """Hauptschleife der Engine."""
        while self._running:
            try:
                await self._run_cycle()
                self.error_handler.reset_consecutive_errors()
            except Exception as e:
                self.error_handler.log_error("PriorityEngine", "Fehler im Zyklus", e)
                if self.error_handler.consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                    self.error_handler.log_error("PriorityEngine", "Zu viele Fehler – Engine wird neu gestartet")
                    await self.async_stop()
                    await asyncio.sleep(5)
                    await self.async_start()
            await asyncio.sleep(30)

    async def _run_cycle(self):
        """Ein einzelner Zyklus der Engine."""
        # Alle Geräte aktualisieren
        for device in self.registry.get_all_devices():
            await device.async_update()

        # Autos erkennen
        await self.auto_detector.async_detect()

        # Verfügbare Leistung berechnen (PV + Netz)
        available_power = await self._get_available_power()

        # Geräte nach Priorität sortieren
        sorted_devices = self._sort_devices_by_priority()

        # Leistung verteilen
        remaining_power = available_power
        for device in sorted_devices:
            if remaining_power <= 0:
                await device.async_turn_off()
                continue

            # Bedarf des Geräts ermitteln
            demand = await self._get_device_demand(device)
            if demand > 0:
                power = min(demand, remaining_power)
                await device.async_set_power(power)
                remaining_power -= power
            else:
                await device.async_turn_off()

    async def _get_available_power(self) -> float:
        """Berechnet die verfügbare Leistung (PV + Netz)."""
        # Platzhalter – später mit echten Sensoren
        return 3.5  # 3.5 kW

    def _sort_devices_by_priority(self) -> list:
        """Sortiert Geräte nach Priorität (niedrige Zahl = höhere Priorität)."""
        # Platzhalter – später aus Entitäten lesen
        return self.registry.get_all_devices()

    async def _get_device_demand(self, device) -> float:
        """Ermittelt den Leistungsbedarf eines Geräts."""
        # Platzhalter – später aus Gerät abfragen
        return 1.0