"""Diagnose-Tool für die PVM-Integration."""

import os
import json
import importlib
import sys
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .logic.error_handler import ErrorHandler

class PVMDiagnostics:
    """Führt eine umfassende Diagnose der Integration durch."""

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self.errors = []
        self.warnings = []
        self.infos = []

    async def async_run_diagnostics(self) -> dict:
        """Führt alle Diagnose-Tests durch und gibt das Ergebnis zurück."""
        self.errors = []
        self.warnings = []
        self.infos = []

        self._check_manifest()
        self._check_const()
        self._check_config_flow()
        self._check_device_types()
        self._check_logic()
        self._check_dashboard()
        await self._check_entities()
        self._check_hacs()

        return {
            "status": "❌ Fehler gefunden" if self.errors else "✅ Alles in Ordnung",
            "errors": self.errors,
            "warnings": self.warnings,
            "infos": self.infos,
            "summary": self._generate_summary()
        }

    def _check_manifest(self):
        """Prüft die manifest.json."""
        try:
            path = self.hass.config.path("custom_components/pvm/manifest.json")
            if not os.path.exists(path):
                self.errors.append("❌ manifest.json nicht gefunden!")
                return
            with open(path, "r") as f:
                data = json.load(f)
                if data.get("domain") != "pvm":
                    self.errors.append(f"❌ domain in manifest.json ist '{data.get('domain')}', sollte 'pvm' sein")
                if data.get("config_flow") is not True:
                    self.errors.append("❌ config_flow in manifest.json ist nicht aktiviert (muss 'true' sein)")
                self.infos.append(f"✅ manifest.json ist vorhanden und valide (Version: {data.get('version', 'unbekannt')})")
        except Exception as e:
            self.errors.append(f"❌ Fehler beim Lesen der manifest.json: {e}")

    def _check_const(self):
        """Prüft die const.py."""
        try:
            path = self.hass.config.path("custom_components/pvm/const.py")
            if not os.path.exists(path):
                self.errors.append("❌ const.py nicht gefunden!")
                return
            # Prüfe, ob DOMAIN definiert ist
            with open(path, "r") as f:
                content = f.read()
                if 'DOMAIN = "pvm"' not in content:
                    self.errors.append("❌ DOMAIN in const.py nicht korrekt definiert (muss 'pvm' sein)")
                self.infos.append("✅ const.py ist vorhanden")
        except Exception as e:
            self.errors.append(f"❌ Fehler beim Lesen der const.py: {e}")

    def _check_config_flow(self):
        """Prüft die config_flow.py."""
        try:
            path = self.hass.config.path("custom_components/pvm/config_flow.py")
            if not os.path.exists(path):
                self.errors.append("❌ config_flow.py nicht gefunden!")
                return
            # Prüfe auf wichtige Imports
            with open(path, "r") as f:
                content = f.read()
                if "import voluptuous as vol" not in content:
                    self.warnings.append("⚠️ voluptuous nicht importiert (wird für Datenvalidierung benötigt)")
                if "class PVMConfigFlow" not in content:
                    self.errors.append("❌ Klasse 'PVMConfigFlow' nicht in config_flow.py gefunden")
                if "async_step_user" not in content:
                    self.errors.append("❌ async_step_user() nicht in config_flow.py implementiert")
                self.infos.append("✅ config_flow.py ist vorhanden")
        except Exception as e:
            self.errors.append(f"❌ Fehler beim Lesen der config_flow.py: {e}")

    def _check_device_types(self):
        """Prüft die device_types."""
        base_path = self.hass.config.path("custom_components/pvm/device_types")
        required_files = ["__init__.py", "base.py", "registry.py", "wallbox.py", "auto.py", "waermepumpe.py", "verbraucher.py"]
        for file in required_files:
            path = os.path.join(base_path, file)
            if not os.path.exists(path):
                self.errors.append(f"❌ {file} nicht gefunden (in device_types/)")
        self.infos.append("✅ device_types/ ist vorhanden")

    def _check_logic(self):
        """Prüft die logic."""
        base_path = self.hass.config.path("custom_components/pvm/logic")
        required_files = ["__init__.py", "priority_engine.py", "load_balancer.py", "scheduler.py", "auto_detector.py", "error_handler.py"]
        for file in required_files:
            path = os.path.join(base_path, file)
            if not os.path.exists(path):
                self.errors.append(f"❌ {file} nicht gefunden (in logic/)")
        self.infos.append("✅ logic/ ist vorhanden")

    def _check_dashboard(self):
        """Prüft das Dashboard."""
        base_path = self.hass.config.path("custom_components/pvm/dashboard")
        required_files = ["__init__.py", "dashboard_creator.py", "lovelace_cards.yaml"]
        for file in required_files:
            path = os.path.join(base_path, file)
            if not os.path.exists(path):
                self.warnings.append(f"⚠️ {file} nicht gefunden (in dashboard/) – Dashboard wird nicht automatisch erstellt")
        self.infos.append("✅ dashboard/ ist vorhanden")

    async def _check_entities(self):
        """Prüft, ob die Integration Entitäten erstellt hat."""
        try:
            entity_registry = er.async_get(self.hass)
            entities = er.async_entries_for_config_entry(entity_registry, self.hass.data.get(DOMAIN, {}).get("entry_id", ""))
            if not entities:
                self.warnings.append("⚠️ Keine Entitäten gefunden – Integration wurde möglicherweise nicht korrekt initialisiert")
            else:
                self.infos.append(f"✅ {len(entities)} Entitäten gefunden")
        except Exception as e:
            self.warnings.append(f"⚠️ Fehler beim Prüfen der Entitäten: {e}")

    def _check_hacs(self):
        """Prüft HACS-Installation."""
        try:
            if "hacs" in self.hass.data:
                self.infos.append("✅ HACS ist installiert")
            else:
                self.warnings.append("⚠️ HACS nicht gefunden – Integration kann nur über HACS installiert werden")
        except Exception as e:
            self.warnings.append(f"⚠️ Fehler beim Prüfen von HACS: {e}")

    def _generate_summary(self) -> str:
        """Erstellt eine Zusammenfassung."""
        if self.errors:
            return f"❌ {len(self.errors)} Fehler gefunden. Bitte behebe die folgenden Probleme: " + "; ".join(self.errors)
        if self.warnings:
            return f"⚠️ {len(self.warnings)} Warnungen gefunden. Die Integration funktioniert, aber einige Funktionen sind eingeschränkt."
        return "✅ Alles in Ordnung – die Integration ist korrekt installiert."