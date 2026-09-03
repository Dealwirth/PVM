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
            try:
                await device.async_update()
            except Exception as e:
                self.error_handler.log_warning("PriorityEngine", f"Fehler beim Aktualisieren von {device.device_id}: {e}")

        # Autos erkennen
        try:
            await self.auto_detector.async_detect()
        except Exception as e:
            self.error_handler.log_warning("PriorityEngine", f"Fehler bei Auto-Erkennung: {e}")

        # Verfügbare Leistung berechnen (PV + Netz)
        available_power = await self._get_available_power()

        # Geräte nach Priorität sortieren (aus input_number lesen)
        sorted_devices = await self._sort_devices_by_priority()

        # Leistung verteilen
        remaining_power = available_power
        for device in sorted_devices:
            if remaining_power <= 0:
                try:
                    await device.async_turn_off()
                except Exception:
                    pass
                continue

            # Bedarf des Geräts ermitteln
            try:
                demand = await self._get_device_demand(device)
                if demand > 0:
                    power = min(demand, remaining_power)
                    await device.async_set_power(power)
                    remaining_power -= power
                else:
                    await device.async_turn_off()
            except Exception as e:
                self.error_handler.log_warning("PriorityEngine", f"Fehler bei Gerät {device.device_id}: {e}")

    async def _get_available_power(self) -> float:
        """Berechnet die verfügbare Leistung (PV + Netz)."""
        # Platzhalter – später mit echten Sensoren
        return 3.5

    async def _sort_devices_by_priority(self) -> list:
        """Sortiert Geräte nach Priorität (niedrige Zahl = höhere Priorität)."""
        devices = self.registry.get_all_devices()
        # Prioritäten aus input_number lesen
        priority_list = []
        for device in devices:
            try:
                input_number_id = f"input_number.priority_{device.device_id}"
                state = self.hass.states.get(input_number_id)
                priority = int(state.state) if state else 5
            except Exception:
                priority = 5
            priority_list.append((priority, device))
        # Nach Priorität sortieren (1 = höchste)
        priority_list.sort(key=lambda x: x[0])
        return [device for _, device in priority_list]

    async def _get_device_demand(self, device) -> float:
        """Ermittelt den Leistungsbedarf eines Geräts."""
        # Platzhalter – später aus Gerät abfragen
        return 1.0