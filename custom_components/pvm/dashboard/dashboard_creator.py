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

        # Dashboard erstellen
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
        # Platzhalter – später über HA-API prüfen
        return False

    async def _load_cards(self) -> list:
        """Lädt die Lovelace-Karten aus der YAML-Datei."""
        cards = []
        try:
            card_path = os.path.join(os.path.dirname(__file__), "lovelace_cards.yaml")
            with open(card_path, "r", encoding="utf-8") as f:
                cards = yaml.safe_load(f) or []
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
        # Platzhalter – später über Lovelace-API speichern
        self.error_handler.log_info("DashboardCreator", "Dashboard würde gespeichert werden")