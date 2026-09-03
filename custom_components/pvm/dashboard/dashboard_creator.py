"""Erstellt automatisch das Lovelace-Dashboard bei der Installation."""

import os
import yaml
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from ..logic.error_handler import ErrorHandler

class DashboardCreator:
    """Erstellt das PVM-Dashboard automatisch."""

    def __init__(self, hass: HomeAssistant, error_handler: ErrorHandler):
        self.hass = hass
        self.error_handler = error_handler

    async def async_create_dashboard(self):
        """Erstellt das Dashboard, falls es noch nicht existiert."""
        # Prüfen, ob Dashboard bereits existiert
        if await self._dashboard_exists():
            self.error_handler.log_info("DashboardCreator", "Dashboard existiert bereits – überspringe")
            return

        # Lovelace-Karten laden
        cards = await self._load_cards()

        # Dashboard-Daten
        dashboard_data = {
            "title": "PV Manager",
            "icon": "mdi:solar-power",
            "views": [
                {
                    "title": "Übersicht",
                    "cards": cards
                }
            ]
        }

        # Dashboard speichern
        await self._save_dashboard(dashboard_data)
        self.error_handler.log_info("DashboardCreator", "Dashboard wurde erfolgreich erstellt")

    async def _dashboard_exists(self) -> bool:
        """Prüft, ob das Dashboard bereits existiert."""
        try:
            # Prüfe, ob es ein Lovelace-Dashboard mit dem Titel "PV Manager" gibt
            lovelace = self.hass.data.get("lovelace")
            if lovelace:
                dashboards = await lovelace.async_get_dashboards()
                for dashboard in dashboards:
                    if dashboard.get("title") == "PV Manager":
                        return True
        except Exception as e:
            self.error_handler.log_warning("DashboardCreator", f"Fehler beim Prüfen des Dashboards: {e}")
        return False

    async def _load_cards(self) -> list:
        """Lädt die Lovelace-Karten aus der YAML-Datei."""
        cards = []
        try:
            card_path = os.path.join(os.path.dirname(__file__), "lovelace_cards.yaml")
            if os.path.exists(card_path):
                with open(card_path, "r", encoding="utf-8") as f:
                    cards = yaml.safe_load(f) or []
            else:
                self.error_handler.log_warning("DashboardCreator", "lovelace_cards.yaml nicht gefunden")
        except Exception as e:
            self.error_handler.log_error("DashboardCreator", "Fehler beim Laden der Karten", e)
            # Fallback: Standardkarten
            cards = [
                {"type": "entities", "entities": ["sensor.pv_power", "sensor.wp_temperature"]},
                {"type": "button", "name": "Power Charge", "entity": "switch.power_charge"}
            ]
        return cards

    async def _save_dashboard(self, data: dict):
        """Speichert das Dashboard in Home Assistant."""
        try:
            lovelace = self.hass.data.get("lovelace")
            if lovelace:
                await lovelace.async_create_dashboard(
                    "pv-manager",
                    data
                )
                self.error_handler.log_info("DashboardCreator", "Dashboard gespeichert")
            else:
                self.error_handler.log_warning("DashboardCreator", "Lovelace nicht verfügbar – Dashboard nicht gespeichert")
        except Exception as e:
            self.error_handler.log_error("DashboardCreator", "Fehler beim Speichern des Dashboards", e)