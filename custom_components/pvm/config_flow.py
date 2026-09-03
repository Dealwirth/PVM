"""Setup-Wizard und Options-Flow für PVM.

Der Wizard führt durch: Begrüßung → Energiesensoren → Geräte hinzufügen
(Schleife) → Fertig. Alles ist YAML-frei und nutzt Entity-Picker.
Die Auto-Erkennung schlägt nur passende Sensoren vor – bestätigt wird im Wizard.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.selector import (
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    TextSelector,
)

from .config_model import default_device, normalize_config
from .const import (
    CONTROL_LABELS,
    CONTROL_SWITCH,
    DOMAIN,
    GRID_KIND_LABELS,
    MODE_LABELS,
    ROLE_LABELS,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
)
from .detector import suggest_devices, suggest_energy
from .store import PvmStore

DONE_OPTION = "Fertig – Einrichtung abschließen"

CONTROL_TO_KEY = {label: key for key, label in CONTROL_LABELS.items()}
GRID_KIND_TO_KEY = {label: key for key, label in GRID_KIND_LABELS.items()}
MODE_TO_KEY = {label: key for key, label in MODE_LABELS.items()}


# ---------------------------------------------------------------------------
# Gemeinsame Helfer
# ---------------------------------------------------------------------------
def _norm_entity(value: Any) -> str | None:
    """Normalisiert einen Entity-Selector-Wert auf eine entity_id oder None."""
    if value is None or value == vol.UNDEFINED:
        return None
    if isinstance(value, (list, tuple)):
        value = value[0] if value else None
    if isinstance(value, dict):
        value = value.get("entity_id")
    if value in ("", None):
        return None
    return str(value)


def _role_from_label(label: Any) -> str | None:
    if label is None:
        return None
    label = str(label).strip()
    for key, text in ROLE_LABELS.items():
        if label == text:
            return key
    return None


def scan_entities(hass: HomeAssistant) -> list[dict]:
    """Liest alle relevanten Entitäten für die Erkennung (schnell)."""
    registry = er.async_get(hass)
    entities: list[dict] = []
    for entry in registry.entities.values():
        if entry.domain not in ("sensor", "switch", "number", "binary_sensor"):
            continue
        if entry.disabled_by or entry.hidden_by:
            continue
        state = hass.states.get(entry.entity_id)
        entities.append(
            {
                "entity_id": entry.entity_id,
                "name": (state and state.name) or entry.original_name or "",
                "device_class": entry.device_class
                or (state.attributes.get("device_class") if state else ""),
                "unit_of_measurement": (
                    state.attributes.get("unit_of_measurement", "") if state else ""
                ),
            }
        )
    return entities


def build_energy_schema(energy: dict | None, suggestions: dict | None) -> vol.Schema:
    """Schema für die Energiesensoren (mit Erkennungs-Vorschlägen)."""
    energy = energy or {}
    sug = (suggestions or {}).get("energy", {})

    def default_for(key: str) -> Any:
        value = energy.get(key) or sug.get(key)
        return value or vol.UNDEFINED

    return vol.Schema(
        {
            vol.Optional("pv_sensor", default=default_for("pv")): EntitySelector(
                EntitySelectorConfig(domain="sensor", multiple=False)
            ),
            vol.Optional("grid_sensor", default=default_for("grid")): EntitySelector(
                EntitySelectorConfig(domain="sensor", multiple=False)
            ),
            vol.Optional("house_sensor", default=default_for("house")): EntitySelector(
                EntitySelectorConfig(domain="sensor", multiple=False)
            ),
            vol.Optional(
                "grid_kind",
                default=GRID_KIND_LABELS.get(
                    energy.get("grid_kind"), list(GRID_KIND_LABELS.values())[0]
                ),
            ): SelectSelector(
                SelectSelectorConfig(options=list(GRID_KIND_LABELS.values()))
            ),
        }
    )


def role_schema(devices_exist: bool) -> vol.Schema:
    """Rollenwahl – nach dem ersten Gerät zusätzlich „Fertig“."""
    options = list(ROLE_LABELS.values())
    if devices_exist:
        options = options + [DONE_OPTION]
    return vol.Schema(
        {
            vol.Required("role"): SelectSelector(
                SelectSelectorConfig(options=options)
            )
        }
    )


def common_controls() -> vol.Schema:
    """Name + „weiteres Gerät?“ (für die Rolle-Formulare)."""
    return vol.Schema(
        {
            vol.Required("name", default=""): TextSelector(),
            vol.Required("another", default=False): BooleanSelector(),
        }
    )


def build_device(role: str, user_input: dict) -> dict:
    """Baut aus Wizard-Eingaben ein (rohes) Geräte-Dict."""
    name = str(user_input.get("name", "")).strip() or "Gerät"
    device = default_device(role, name)
    if role == ROLE_WALLBOX:
        device["control"] = {
            "type": CONTROL_TO_KEY.get(
                str(user_input.get("control_type", "")), CONTROL_SWITCH
            ),
            "switch_entity": _norm_entity(user_input.get("switch_entity")),
            "number_entity": _norm_entity(user_input.get("number_entity")),
            "number_unit": str(user_input.get("number_unit", "W")),
            "phases": 3 if str(user_input.get("phases", "")) == "3 Phasen" else 1,
        }
        device["sensors"] = {
            "power": _norm_entity(user_input.get("power_sensor")),
            "soc": _norm_entity(user_input.get("soc_sensor")),
            "temp": None,
        }
        car = device["car"]
        car["capacity_kwh"] = float(user_input.get("capacity_kwh", 60) or 60)
        car["min_soc"] = float(user_input.get("min_soc", 50) or 50)
        car["max_soc"] = float(user_input.get("max_soc", 80) or 80)
        car["grid_min_allowed"] = bool(user_input.get("grid_min", True))
        car["grid_deadline_allowed"] = bool(user_input.get("grid_deadline", True))
        device["limits"]["power_limit_w"] = float(
            user_input.get("max_power_kw", 11) or 11
        ) * 1000.0
    elif role == ROLE_WAERMEPUMPE:
        device["control"] = {
            "type": CONTROL_SWITCH,
            "switch_entity": _norm_entity(user_input.get("switch_entity")),
            "number_entity": None,
            "number_unit": "W",
            "phases": 3,
        }
        device["sensors"] = {
            "power": _norm_entity(user_input.get("power_sensor")),
            "soc": None,
            "temp": _norm_entity(user_input.get("temp_sensor")),
        }
        device["wp"]["est_power_w"] = float(user_input.get("est_power_kw", 2) or 2) * 1000.0
    else:  # Verbraucher
        device["control"] = {
            "type": CONTROL_SWITCH,
            "switch_entity": _norm_entity(user_input.get("switch_entity")),
            "number_entity": None,
            "number_unit": "W",
            "phases": 3,
        }
        device["sensors"] = {
            "power": _norm_entity(user_input.get("power_sensor")),
            "soc": None,
            "temp": None,
        }
        device["limits"]["nominal_power_w"] = float(user_input.get("nominal_kw", 2) or 2) * 1000.0
    return device


# ---------------------------------------------------------------------------
# Setup-Flow
# ---------------------------------------------------------------------------
class PVMConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Konfigurations-Flow für PVM."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialisiert die Flow-Daten."""
        super().__init__()
        self._energy: dict[str, Any] = {}
        self._devices: list[dict] = []
        self._suggestions: dict[str, Any] | None = None

    async def async_step_user(self, user_input=None):
        """Begrüßung: Automatisch oder manuell?."""
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        return self.async_show_menu(step_id="user", menu_options=["auto", "manual"])

    async def async_step_auto(self, user_input=None):
        """Startet die Erkennung und geht zu den Energiesensoren."""
        self._suggestions = {
            "energy": suggest_energy(await self.hass.async_add_executor_job(scan_entities, self.hass)),
            "devices": suggest_devices(await self.hass.async_add_executor_job(scan_entities, self.hass)),
        }
        return await self.async_step_energy(None)

    async def async_step_manual(self, user_input=None):
        """Manueller Weg: direkt zu den Energiesensoren."""
        return await self.async_step_energy(None)

    async def async_step_energy(self, user_input=None):
        """Energiesensoren wählen (PV, optional Netz, optional Haus)."""
        errors: dict[str, str] = {}
        if user_input is not None:
            self._energy = {
                "pv_sensor": _norm_entity(user_input.get("pv_sensor")),
                "grid_sensor": _norm_entity(user_input.get("grid_sensor")),
                "house_sensor": _norm_entity(user_input.get("house_sensor")),
                "grid_kind": GRID_KIND_TO_KEY.get(user_input.get("grid_kind"), "net"),
            }
            if not (self._energy["pv_sensor"] or self._energy["grid_sensor"]):
                errors["base"] = "need_energy_sensor"
            else:
                return await self.async_step_role(None)
        return self.async_show_form(
            step_id="energy",
            data_schema=build_energy_schema(self._energy, self._suggestions),
            errors=errors,
        )

    # ------------------------------------------------------------------
    # Geräte hinzufügen (Schleife)
    # ------------------------------------------------------------------
    async def async_step_role(self, user_input=None):
        """Wählt Rolle des nächsten Geräts oder „Fertig“."""
        if user_input is not None:
            label = user_input.get("role")
            if label == DONE_OPTION:
                return await self.async_step_finish(None)
            role = _role_from_label(label)
            if role == ROLE_WALLBOX:
                return await self.async_step_wallbox(None)
            if role == ROLE_WAERMEPUMPE:
                return await self.async_step_waermepumpe(None)
            if role == ROLE_VERBRAUCHER:
                return await self.async_step_verbraucher(None)
        return self.async_show_form(
            step_id="role", data_schema=role_schema(bool(self._devices))
        )

    def _device_defaults(self, role: str) -> dict[str, Any]:
        """Vorschläge aus der Erkennung für ein Formular."""
        if not self._suggestions:
            return {}
        found = self._suggestions.get("devices", {})
        defaults: dict[str, Any] = {}
        if role == ROLE_WALLBOX:
            if found.get("wallbox"):
                defaults["power_sensor"] = found["wallbox"][0]
            if found.get("auto_soc"):
                defaults["soc_sensor"] = found["auto_soc"][0]
        elif role == ROLE_WAERMEPUMPE and found.get("wp_temp"):
            defaults["temp_sensor"] = found["wp_temp"][0]
        return defaults

    def wallbox_schema(self) -> vol.Schema:
        """Formular für Wallbox/Auto."""
        defaults = self._device_defaults(ROLE_WALLBOX)
        return vol.Schema(
            {
                vol.Required("name", default=""): TextSelector(),
                vol.Required(
                    "control_type", default=list(CONTROL_LABELS.values())[0]
                ): SelectSelector(
                    SelectSelectorConfig(options=list(CONTROL_LABELS.values()))
                ),
                vol.Optional("switch_entity"): EntitySelector(
                    EntitySelectorConfig(multiple=False)
                ),
                vol.Optional("number_entity"): EntitySelector(
                    EntitySelectorConfig(domain=["number", "input_number"], multiple=False)
                ),
                vol.Optional(
                    "power_sensor", default=defaults.get("power_sensor", vol.UNDEFINED)
                ): EntitySelector(EntitySelectorConfig(domain="sensor", multiple=False)),
                vol.Optional(
                    "soc_sensor", default=defaults.get("soc_sensor", vol.UNDEFINED)
                ): EntitySelector(EntitySelectorConfig(domain="sensor", multiple=False)),
                vol.Required("capacity_kwh", default=60.0): NumberSelector(
                    NumberSelectorConfig(min=1, max=300, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="kWh")
                ),
                vol.Required("max_power_kw", default=11.0): NumberSelector(
                    NumberSelectorConfig(min=1.1, max=22, step=0.1, mode=NumberSelectorMode.BOX, unit_of_measurement="kW")
                ),
                vol.Required("min_soc", default=50): NumberSelector(
                    NumberSelectorConfig(min=0, max=95, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="%")
                ),
                vol.Required("max_soc", default=80): NumberSelector(
                    NumberSelectorConfig(min=30, max=100, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="%")
                ),
                vol.Required("phases", default="3 Phasen"): SelectSelector(
                    SelectSelectorConfig(options=["1 Phase", "3 Phasen"])
                ),
                vol.Required("number_unit", default="W"): SelectSelector(
                    SelectSelectorConfig(options=["W", "kW", "A", "mA"])
                ),
                vol.Required("grid_min", default=True): BooleanSelector(),
                vol.Required("grid_deadline", default=True): BooleanSelector(),
                vol.Required("another", default=False): BooleanSelector(),
            }
        )

    async def async_step_wallbox(self, user_input=None):
        """Wallbox-/Auto-Daten erfassen."""
        if user_input is not None:
            self._devices.append(build_device(ROLE_WALLBOX, user_input))
            if user_input.get("another"):
                return await self.async_step_role(None)
            return await self.async_step_finish(None)
        return self.async_show_form(
            step_id="wallbox", data_schema=self.wallbox_schema()
        )

    def wp_schema(self) -> vol.Schema:
        """Formular für die Wärmepumpe."""
        defaults = self._device_defaults(ROLE_WAERMEPUMPE)
        return vol.Schema(
            {
                vol.Required("name", default=""): TextSelector(),
                vol.Optional("switch_entity"): EntitySelector(
                    EntitySelectorConfig(multiple=False)
                ),
                vol.Optional(
                    "temp_sensor", default=defaults.get("temp_sensor", vol.UNDEFINED)
                ): EntitySelector(EntitySelectorConfig(domain="sensor", multiple=False)),
                vol.Optional("power_sensor"): EntitySelector(
                    EntitySelectorConfig(domain="sensor", multiple=False)
                ),
                vol.Required("est_power_kw", default=2.0): NumberSelector(
                    NumberSelectorConfig(min=0.5, max=22, step=0.1, mode=NumberSelectorMode.BOX, unit_of_measurement="kW")
                ),
                vol.Required("another", default=False): BooleanSelector(),
            }
        )

    async def async_step_waermepumpe(self, user_input=None):
        """Wärmepumpen-Daten erfassen."""
        if user_input is not None:
            self._devices.append(build_device(ROLE_WAERMEPUMPE, user_input))
            if user_input.get("another"):
                return await self.async_step_role(None)
            return await self.async_step_finish(None)
        return self.async_show_form(
            step_id="waermepumpe", data_schema=self.wp_schema()
        )

    def consumer_schema(self) -> vol.Schema:
        """Formular für Verbraucher."""
        return vol.Schema(
            {
                vol.Required("name", default=""): TextSelector(),
                vol.Optional("switch_entity"): EntitySelector(
                    EntitySelectorConfig(multiple=False)
                ),
                vol.Optional("power_sensor"): EntitySelector(
                    EntitySelectorConfig(domain="sensor", multiple=False)
                ),
                vol.Required("nominal_kw", default=2.0): NumberSelector(
                    NumberSelectorConfig(min=0.1, max=22, step=0.1, mode=NumberSelectorMode.BOX, unit_of_measurement="kW")
                ),
                vol.Required("another", default=False): BooleanSelector(),
            }
        )

    async def async_step_verbraucher(self, user_input=None):
        """Verbraucher-Daten erfassen (Waschmaschine, Lüftung, …)."""
        if user_input is not None:
            self._devices.append(build_device(ROLE_VERBRAUCHER, user_input))
            if user_input.get("another"):
                return await self.async_step_role(None)
            return await self.async_step_finish(None)
        return self.async_show_form(
            step_id="verbraucher", data_schema=self.consumer_schema()
        )

    async def async_step_finish(self, user_input=None):
        """Erstellt den Config-Eintrag und persistiert die Konfiguration."""
        config = normalize_config(
            {"energy": self._energy, "settings": {}, "devices": self._devices}
        )
        # Vor dem Anlegen speichern, damit die Geräte sofort da sind
        store = PvmStore(self.hass)
        await store.async_save(config)
        return self.async_create_entry(title="PV Manager", data={"config_v": 1})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Options-Flow für PVM."""
        return PVMOptionsFlow(config_entry)


# ---------------------------------------------------------------------------
# Options-Flow
# ---------------------------------------------------------------------------
class PVMOptionsFlow(config_entries.OptionsFlow):
    """Bearbeitet Energiesensoren, Geräte und Einstellungen."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialisiert die Options-Daten."""
        super().__init__()
        self.config_entry = config_entry
        self._energy: dict[str, Any] = {}
        self._settings: dict[str, Any] = {}
        self._devices: list[dict] = []
        self._loaded = False

    async def _ensure_loaded(self) -> None:
        if not self._loaded:
            config = await PvmStore(self.hass).async_load()
            self._energy = config.get("energy", {})
            self._settings = config.get("settings", {})
            self._devices = config.get("devices", [])
            self._loaded = True

    async def _save(self) -> None:
        store = PvmStore(self.hass)
        old = await store.async_load()
        await store.async_save(
            normalize_config(
                {
                    "energy": self._energy,
                    "settings": self._settings,
                    "devices": self._devices,
                    # WP-Test-Ergebnisse beim Speichern der Optionen behalten
                    "wp_test_results": old.get("wp_test_results", {}),
                }
            )
        )
        # Laufende Instanz sofort auf den neuen Stand bringen
        self.hass.config_entries.async_schedule_reload(self.config_entry.entry_id)

    async def async_step_init(self, user_input=None):
        """Menü der Options-Oberfläche."""
        await self._ensure_loaded()
        return self.async_show_menu(
            step_id="init", menu_options=["energy", "devices", "settings", "done"]
        )

    async def async_step_energy(self, user_input=None):
        """Energiesensoren bearbeiten."""
        if user_input is not None:
            self._energy = {
                "pv_sensor": _norm_entity(user_input.get("pv_sensor")),
                "grid_sensor": _norm_entity(user_input.get("grid_sensor")),
                "house_sensor": _norm_entity(user_input.get("house_sensor")),
                "grid_kind": GRID_KIND_TO_KEY.get(user_input.get("grid_kind"), "net"),
            }
            if not (self._energy["pv_sensor"] or self._energy["grid_sensor"]):
                return self.async_show_form(
                    step_id="energy",
                    data_schema=build_energy_schema(self._energy, None),
                    errors={"base": "need_energy_sensor"},
                )
            await self._save()
            return await self.async_step_init(None)
        return self.async_show_form(
            step_id="energy", data_schema=build_energy_schema(self._energy, None)
        )

    async def async_step_devices(self, user_input=None):
        """Geräte verwalten."""
        options = ["add", "remove"] if self._devices else ["add"]
        return self.async_show_menu(step_id="devices", menu_options=options)

    async def async_step_add(self, user_input=None):
        """Neues Gerät hinzufügen (Rollenwahl)."""
        if user_input is not None:
            role = _role_from_label(user_input.get("role"))
            if role == ROLE_WALLBOX:
                return await self.async_step_add_wallbox(None)
            if role == ROLE_WAERMEPUMPE:
                return await self.async_step_add_wp(None)
            if role == ROLE_VERBRAUCHER:
                return await self.async_step_add_consumer(None)
        return self.async_show_form(
            step_id="add", data_schema=role_schema(False)
        )

    async def async_step_add_wallbox(self, user_input=None):
        if user_input is not None:
            self._devices.append(build_device(ROLE_WALLBOX, user_input))
            await self._save()
            return await self.async_step_devices(None)
        return self.async_show_form(
            step_id="add_wallbox",
            data_schema=vol.Schema(
                {
                    **wallbox_fields(True),
                }
            ),
        )

    async def async_step_add_wp(self, user_input=None):
        if user_input is not None:
            self._devices.append(build_device(ROLE_WAERMEPUMPE, user_input))
            await self._save()
            return await self.async_step_devices(None)
        return self.async_show_form(
            step_id="add_wp",
            data_schema=vol.Schema(
                {
                    **wp_fields(True),
                }
            ),
        )

    async def async_step_add_consumer(self, user_input=None):
        if user_input is not None:
            self._devices.append(build_device(ROLE_VERBRAUCHER, user_input))
            await self._save()
            return await self.async_step_devices(None)
        return self.async_show_form(
            step_id="add_consumer",
            data_schema=vol.Schema(
                {
                    **consumer_fields(True),
                }
            ),
        )

    async def async_step_remove(self, user_input=None):
        """Gerät entfernen."""
        if not self._devices:
            return await self.async_step_devices(None)
        options = [f"{d.get('name')} ({d['id'][:6]})" for d in self._devices]
        if user_input is not None:
            selected = str(user_input.get("device", ""))
            self._devices = [
                d
                for d in self._devices
                if f"{d.get('name')} ({d['id'][:6]})" != selected
            ]
            await self._save()
            return await self.async_step_devices(None)
        return self.async_show_form(
            step_id="remove",
            data_schema=vol.Schema(
                {
                    vol.Required("device"): SelectSelector(
                        SelectSelectorConfig(options=options)
                    )
                }
            ),
        )

    async def async_step_settings(self, user_input=None):
        """Globale Einstellungen."""
        if user_input is not None:
            mode_label = user_input.get("mode")
            self._settings.update(
                {
                    "mode": MODE_TO_KEY.get(mode_label, "auto"),
                    "reserve_w": float(user_input.get("reserve_w", 100)),
                    "cycle_s": float(user_input.get("cycle_s", 30)),
                    "min_on_s": float(user_input.get("min_on_s", 120)),
                    "min_off_s": float(user_input.get("min_off_s", 60)),
                    "wp_test_target_c": float(user_input.get("wp_test_target_c", 70)),
                    "wp_test_max_duration_min": float(
                        user_input.get("wp_test_max_duration_min", 120)
                    ),
                }
            )
            await self._save()
            return await self.async_step_init(None)
        settings = self._settings or {}
        return self.async_show_form(
            step_id="settings",
            data_schema=settings_schema(settings),
        )

    async def async_step_done(self, user_input=None):
        """Beendet die Options-Bearbeitung."""
        await self._save()
        return self.async_create_entry(title="", data={})


# ---------------------------------------------------------------------------
# Feld-Definitionen (werden von Wizard- und Options-Flow geteilt)
# ---------------------------------------------------------------------------
def wallbox_fields(include_another: bool) -> dict:
    """Alle Felder des Wallbox-Formulars als dict (vol.Optional/Required)."""
    fields: dict = {
        vol.Required("name", default=""): TextSelector(),
        vol.Required(
            "control_type", default=list(CONTROL_LABELS.values())[0]
        ): SelectSelector(SelectSelectorConfig(options=list(CONTROL_LABELS.values()))),
        vol.Optional("switch_entity"): EntitySelector(
            EntitySelectorConfig(multiple=False)
        ),
        vol.Optional("number_entity"): EntitySelector(
            EntitySelectorConfig(domain=["number", "input_number"], multiple=False)
        ),
        vol.Optional("power_sensor"): EntitySelector(
            EntitySelectorConfig(domain="sensor", multiple=False)
        ),
        vol.Optional("soc_sensor"): EntitySelector(
            EntitySelectorConfig(domain="sensor", multiple=False)
        ),
        vol.Required("capacity_kwh", default=60.0): NumberSelector(
            NumberSelectorConfig(min=1, max=300, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="kWh")
        ),
        vol.Required("max_power_kw", default=11.0): NumberSelector(
            NumberSelectorConfig(min=1.1, max=22, step=0.1, mode=NumberSelectorMode.BOX, unit_of_measurement="kW")
        ),
        vol.Required("min_soc", default=50): NumberSelector(
            NumberSelectorConfig(min=0, max=95, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="%")
        ),
        vol.Required("max_soc", default=80): NumberSelector(
            NumberSelectorConfig(min=30, max=100, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="%")
        ),
        vol.Required("phases", default="3 Phasen"): SelectSelector(
            SelectSelectorConfig(options=["1 Phase", "3 Phasen"])
        ),
        vol.Required("number_unit", default="W"): SelectSelector(
            SelectSelectorConfig(options=["W", "kW", "A", "mA"])
        ),
        vol.Required("grid_min", default=True): BooleanSelector(),
        vol.Required("grid_deadline", default=True): BooleanSelector(),
    }
    if include_another:
        fields[vol.Required("another", default=False)] = BooleanSelector()
    return fields


def wp_fields(include_another: bool) -> dict:
    """Felder des WP-Formulars."""
    fields: dict = {
        vol.Required("name", default=""): TextSelector(),
        vol.Optional("switch_entity"): EntitySelector(
            EntitySelectorConfig(multiple=False)
        ),
        vol.Optional("temp_sensor"): EntitySelector(
            EntitySelectorConfig(domain="sensor", multiple=False)
        ),
        vol.Optional("power_sensor"): EntitySelector(
            EntitySelectorConfig(domain="sensor", multiple=False)
        ),
        vol.Required("est_power_kw", default=2.0): NumberSelector(
            NumberSelectorConfig(min=0.5, max=22, step=0.1, mode=NumberSelectorMode.BOX, unit_of_measurement="kW")
        ),
    }
    if include_another:
        fields[vol.Required("another", default=False)] = BooleanSelector()
    return fields


def consumer_fields(include_another: bool) -> dict:
    """Felder des Verbraucher-Formulars."""
    fields: dict = {
        vol.Required("name", default=""): TextSelector(),
        vol.Optional("switch_entity"): EntitySelector(
            EntitySelectorConfig(multiple=False)
        ),
        vol.Optional("power_sensor"): EntitySelector(
            EntitySelectorConfig(domain="sensor", multiple=False)
        ),
        vol.Required("nominal_kw", default=2.0): NumberSelector(
            NumberSelectorConfig(min=0.1, max=22, step=0.1, mode=NumberSelectorMode.BOX, unit_of_measurement="kW")
        ),
    }
    if include_another:
        fields[vol.Required("another", default=False)] = BooleanSelector()
    return fields


def settings_schema(settings: dict) -> vol.Schema:
    """Schema für die globalen Einstellungen."""
    return vol.Schema(
        {
            vol.Required(
                "mode",
                default=MODE_LABELS.get(settings.get("mode"), list(MODE_LABELS.values())[0]),
            ): SelectSelector(SelectSelectorConfig(options=list(MODE_LABELS.values()))),
            vol.Required("reserve_w", default=settings.get("reserve_w", 100)): NumberSelector(
                NumberSelectorConfig(min=0, max=2000, step=10, unit_of_measurement="W")
            ),
            vol.Required("cycle_s", default=settings.get("cycle_s", 30)): NumberSelector(
                NumberSelectorConfig(min=10, max=300, step=5, unit_of_measurement="s")
            ),
            vol.Required("min_on_s", default=settings.get("min_on_s", 120)): NumberSelector(
                NumberSelectorConfig(min=30, max=600, step=10, unit_of_measurement="s")
            ),
            vol.Required("min_off_s", default=settings.get("min_off_s", 60)): NumberSelector(
                NumberSelectorConfig(min=10, max=300, step=10, unit_of_measurement="s")
            ),
            vol.Required("wp_test_target_c", default=settings.get("wp_test_target_c", 70)): NumberSelector(
                NumberSelectorConfig(min=50, max=80, step=1, unit_of_measurement="°C")
            ),
            vol.Required("wp_test_max_duration_min", default=settings.get("wp_test_max_duration_min", 120)): NumberSelector(
                NumberSelectorConfig(min=10, max=600, step=10, unit_of_measurement="min")
            ),
        }
    )
