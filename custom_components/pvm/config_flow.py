"""PVM – Konfiguration & Verwaltung (ohne Installations-Wizard).

Installation: Ein Klick, keine Fragen – der Config-Flow legt den Eintrag
sofort an; alles Weitere passiert im Dashboard.

Verwaltung (Options-Flow – einzelne kurze Dialoge, aus dem Dashboard
gestartet):
- Messungen: PV-/Netz-/Haus-Sensor wählen („habe ich / habe ich nicht“)
- Geräte: hinzufügen, bearbeiten, entfernen (mit dynamischen Steuerfeldern)
- Gefunden übernehmen: Erkennungs-Vorschläge prüfen und bestätigen
- Erweitert: globale Werte (Reserve, Zeiten, WP-Test)
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
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
    CONTROL_BUTTONS,
    CONTROL_LABELS,
    CONTROL_SWITCH,
    CONTROL_SWITCH_NUMBER,
    DOMAIN,
    GRID_KIND_LABELS,
    MODE_LABELS,
    NAME,
    ROLE_LABELS,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
)
from .detector import suggest_sets
from .store import PvmStore

# Messungs-Rollen (deutsche Kurzbezeichnung für die Übernahme-Liste)
MEASURE_ROLES = ("pv", "grid", "house")
MEASURE_LABELS = {
    "pv": "PV-Leistung",
    "grid": "Netzbezug / Einspeisung",
    "house": "Hausverbrauch",
}

# Entitäten-Domänen, die für Messwerte sinnvoll sind (Sensor oder Nummer)
_READ_DOMAINS = ["sensor", "number", "input_number"]
_SWITCH_DOMAINS = ["switch", "input_boolean"]
_BUTTON_DOMAINS = ["button", "switch", "input_boolean"]
_LIMIT_DOMAINS = ["number", "input_number"]

CONTROL_TO_KEY = {label: key for key, label in CONTROL_LABELS.items()}
GRID_KIND_TO_KEY = {label: key for key, label in GRID_KIND_LABELS.items()}
MODE_TO_KEY = {label: key for key, label in MODE_LABELS.items()}
ROLE_TO_KEY = {label: key for key, label in ROLE_LABELS.items()}


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


def _bool(value: Any) -> bool:
    return bool(value)


def scan_entities(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Liest alle relevanten Entitäten inkl. Geräte-/Hersteller-Informationen."""
    registry = er.async_get(hass)
    devices = dr.async_get(hass)
    entities: list[dict[str, Any]] = []
    for entry in registry.entities.values():
        if entry.domain not in {
            "sensor", "switch", "number", "binary_sensor", "button",
            "select", "input_boolean", "input_number", "input_select",
        }:
            continue
        if entry.disabled_by or entry.hidden_by:
            continue
        state = hass.states.get(entry.entity_id)
        device_id = entry.device_id or None
        manufacturer = ""
        model = ""
        device_name = ""
        if device_id and devices is not None:
            device = devices.async_get(device_id)
            if device:
                manufacturer = str(device.manufacturer or "")
                model = str(device.model or "")
                device_name = str(device.name or "")
        entities.append(
            {
                "entity_id": entry.entity_id,
                "name": (state and state.name) or entry.original_name or "",
                "device_class": entry.device_class
                or (state.attributes.get("device_class") if state else ""),
                "unit_of_measurement": (
                    state.attributes.get("unit_of_measurement", "") if state else ""
                ),
                "state_value": (state.state if state else ""),
                "device_id": device_id,
                "manufacturer": manufacturer,
                "model": model,
                "device_name": device_name,
                "integration": str(entry.platform or ""),
            }
        )
    return entities


async def _load_config(hass: HomeAssistant) -> dict[str, Any]:
    return await PvmStore(hass).async_load()


def _entity_options(candidates: list[dict]) -> tuple[dict[str, str], list[str]]:
    """Baut (label -> entity_id, optionen) für eine Kandidatenliste."""
    mapping: dict[str, str] = {}
    options: list[str] = []
    for candidate in candidates:
        name = str(candidate.get("name") or candidate.get("entity_id"))
        state = candidate.get("state") or ""
        label = f"{name} – {state}".strip(" –") if state else name
        if label in mapping:  # Eindeutigkeit für die Select-Zuordnung
            label = f"{label} ({candidate.get('entity_id')})"
        mapping[label] = str(candidate.get("entity_id"))
        options.append(label)
    return mapping, options


def _build_energy_fields(energy: dict[str, Any]) -> dict:
    """Formular für Energie-Messungen (mit „habe ich“-Schaltern)."""
    pv = energy.get("pv_sensor")
    grid = energy.get("grid_sensor")
    house = energy.get("house_sensor")
    return {
        vol.Required("pv_enabled", default=bool(pv)): BooleanSelector(),
        vol.Optional("pv_sensor", default=pv or vol.UNDEFINED): EntitySelector(
            EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False)
        ),
        vol.Required("grid_enabled", default=bool(grid)): BooleanSelector(),
        vol.Optional("grid_sensor", default=grid or vol.UNDEFINED): EntitySelector(
            EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False)
        ),
        vol.Required(
            "grid_kind",
            default=GRID_KIND_LABELS.get(
                energy.get("grid_kind"), list(GRID_KIND_LABELS.values())[0]
            ),
        ): SelectSelector(SelectSelectorConfig(options=list(GRID_KIND_LABELS.values()))),
        vol.Required("house_enabled", default=bool(house)): BooleanSelector(),
        vol.Optional("house_sensor", default=house or vol.UNDEFINED): EntitySelector(
            EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False)
        ),
    }


# ---------------------------------------------------------------------------
# Setup-Flow: kein Wizard – sofortiger Eintrag
# ---------------------------------------------------------------------------
class PVMConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Konfigurations-Flow für PVM (ein Klick, keine Fragen)."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Legt den Eintrag direkt an – alles Weitere läuft im Dashboard."""
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")
        return self.async_create_entry(title=NAME, data={})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Options-Flow für PVM (kurze Verwaltungs-Dialoge)."""
        return PVMOptionsFlow(config_entry)


# ---------------------------------------------------------------------------
# Options-Flow (Verwaltung aus dem Dashboard)
# ---------------------------------------------------------------------------
class PVMOptionsFlow(config_entries.OptionsFlow):
    """Bearbeitet Messungen, Geräte, Erkennung und Einstellungen."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialisiert den Options-Flow."""
        super().__init__()
        self.config_entry = config_entry
        self._energy: dict[str, Any] = {}
        self._settings: dict[str, Any] = {}
        self._devices: list[dict] = []
        self._loaded = False

        # Zustand für Geräte-Dialoge (hinzufügen/bearbeiten/übernehmen)
        self._edit_id: str | None = None
        self._role: str = ROLE_VERBRAUCHER
        self._control_type: str = CONTROL_SWITCH
        self._prefill: dict[str, Any] = {}
        self._adopt_entities: dict[str, str] = {}
        self._adopt_role: str | None = None

    # ------------------------------------------------------------------
    # Laden/Speichern
    # ------------------------------------------------------------------
    async def _ensure_loaded(self) -> None:
        if not self._loaded:
            config = await _load_config(self.hass)
            self._energy = config.get("energy", {})
            self._settings = config.get("settings", {})
            self._devices = config.get("devices", [])
            self._loaded = True

    async def _save(self, rebuild: bool = True) -> None:
        store = PvmStore(self.hass)
        old = await store.async_load()
        settings = dict(self._settings)
        if rebuild:
            # Marker: Dashboard nach dem Reload automatisch aktualisieren
            settings["dashboard_rebuild"] = True
        await store.async_save(
            normalize_config(
                {
                    "energy": self._energy,
                    "settings": settings,
                    "devices": self._devices,
                    "wp_test_results": old.get("wp_test_results", {}),
                }
            )
        )
        self.hass.config_entries.async_schedule_reload(self.config_entry.entry_id)

    # ------------------------------------------------------------------
    # Menü
    # ------------------------------------------------------------------
    async def async_step_init(self, user_input=None):
        """Hauptmenü der Verwaltung."""
        await self._ensure_loaded()
        return self.async_show_menu(
            step_id="init",
            menu_options=["messungen", "geraete", "found", "erweitert"],
        )

    # ------------------------------------------------------------------
    # Messungen
    # ------------------------------------------------------------------
    async def async_step_messungen(self, user_input=None):
        """PV-/Netz-/Haus-Sensoren wählen (mit „habe ich“-Schaltern)."""
        if user_input is not None:
            self._energy = {
                "pv_sensor": (
                    _norm_entity(user_input.get("pv_sensor"))
                    if _bool(user_input.get("pv_enabled"))
                    else None
                ),
                "grid_sensor": (
                    _norm_entity(user_input.get("grid_sensor"))
                    if _bool(user_input.get("grid_enabled"))
                    else None
                ),
                "house_sensor": (
                    _norm_entity(user_input.get("house_sensor"))
                    if _bool(user_input.get("house_enabled"))
                    else None
                ),
                "grid_kind": GRID_KIND_TO_KEY.get(
                    user_input.get("grid_kind"), "net"
                ),
            }
            await self._save()
            return await self.async_step_init(None)
        return self.async_show_form(
            step_id="messungen",
            data_schema=vol.Schema(_build_energy_fields(self._energy)),
        )

    # ------------------------------------------------------------------
    # Geräte-Verwaltung
    # ------------------------------------------------------------------
    async def async_step_geraete(self, user_input=None):
        """Menü der Geräte-Verwaltung."""
        options = ["add"]
        if self._devices:
            options += ["edit", "remove"]
        return self.async_show_menu(step_id="geraete", menu_options=options)

    async def async_step_add(self, user_input=None):
        """Gerät hinzufügen – Rollenwahl."""
        if user_input is not None:
            role = ROLE_TO_KEY.get(str(user_input.get("role", "")))
            if role:
                self._role = role
                self._edit_id = None
                self._prefill = {}
                return await self.async_step_device_basics(None)
        return self.async_show_form(
            step_id="add",
            data_schema=vol.Schema(
                {
                    vol.Required("role"): SelectSelector(
                        SelectSelectorConfig(options=list(ROLE_LABELS.values()))
                    )
                }
            ),
        )

    async def async_step_edit(self, user_input=None):
        """Gerät auswählen und bearbeiten."""
        if user_input is not None:
            selected = str(user_input.get("device", ""))
            for device in self._devices:
                if f"{device.get('name')} ({device['id'][:6]})" == selected:
                    self._edit_id = device["id"]
                    self._role = device.get("role", ROLE_VERBRAUCHER)
                    self._prefill = dict(device)
                    return await self.async_step_device_basics(None)
        options = [f"{d.get('name')} ({d['id'][:6]})" for d in self._devices]
        return self.async_show_form(
            step_id="edit",
            data_schema=vol.Schema(
                {
                    vol.Required("device"): SelectSelector(
                        SelectSelectorConfig(options=options)
                    )
                }
            ),
        )

    async def async_step_remove(self, user_input=None):
        """Gerät entfernen."""
        if user_input is not None:
            selected = str(user_input.get("device", ""))
            self._devices = [
                d
                for d in self._devices
                if f"{d.get('name')} ({d['id'][:6]})" != selected
            ]
            await self._save()
            return await self.async_step_geraete(None)
        options = [f"{d.get('name')} ({d['id'][:6]})" for d in self._devices]
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

    # ------------------------------------------------------------------
    # Geräte-Formulare (dynamisch je Steuerungsart)
    # ------------------------------------------------------------------
    async def async_step_device_basics(self, user_input=None):
        """Schritt 1: Name + Steuerungsart wählen."""
        if user_input is not None:
            self._control_type = CONTROL_TO_KEY.get(
                str(user_input.get("control_type", "")), CONTROL_SWITCH
            )
            name = str(user_input.get("name", "")).strip()
            self._prefill = dict(self._prefill)
            self._prefill["name"] = name or self._prefill.get("name", "") or "Gerät"
            return await self.async_step_device_fields(None)

        defaults = {
            "name": self._prefill.get("name", ""),
            "control_type": CONTROL_LABELS.get(
                self._prefill.get("control", {}).get("type", CONTROL_SWITCH)
                if self._prefill
                else CONTROL_SWITCH,
                list(CONTROL_LABELS.values())[0],
            ),
        }
        schema = {
            vol.Required("name", default=defaults["name"]): TextSelector(),
            vol.Required("control_type", default=defaults["control_type"]): SelectSelector(
                SelectSelectorConfig(options=list(CONTROL_LABELS.values()))
            ),
        }
        # Bei Verbraucher/Wärmepumpe kein Leistungs-Limit anbieten
        if self._role != ROLE_WALLBOX:
            allowed = [
                CONTROL_LABELS[CONTROL_SWITCH],
                CONTROL_LABELS[CONTROL_BUTTONS],
            ]
            schema[vol.Required("control_type", default=defaults["control_type"])] = (
                SelectSelector(SelectSelectorConfig(options=allowed))
            )
        return self.async_show_form(
            step_id="device_basics",
            data_schema=vol.Schema(schema),
        )

    def _control_fields(self) -> dict:
        """Felder der Steuerung (passend zur gewählten Steuerungsart)."""
        control = (self._prefill or {}).get("control", {}) or {}
        fields: dict = {}
        if self._control_type == CONTROL_BUTTONS:
            fields[vol.Optional("on_entity", default=control.get("on_entity") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_BUTTON_DOMAINS, multiple=False))
            )
            fields[vol.Optional("off_entity", default=control.get("off_entity") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_BUTTON_DOMAINS, multiple=False))
            )
        else:
            fields[vol.Optional("switch_entity", default=control.get("switch_entity") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_SWITCH_DOMAINS, multiple=False))
            )
            if self._control_type == CONTROL_SWITCH_NUMBER:
                fields[vol.Optional("number_entity", default=control.get("number_entity") or vol.UNDEFINED)] = (
                    EntitySelector(EntitySelectorConfig(domain=_LIMIT_DOMAINS, multiple=False))
                )
                fields[vol.Required(
                    "number_unit",
                    default=control.get("number_unit", "W"),
                )] = SelectSelector(SelectSelectorConfig(options=["W", "kW", "A", "mA"]))
                fields[vol.Required(
                    "phases",
                    default="3 Phasen" if control.get("phases", 3) == 3 else "1 Phase",
                )] = SelectSelector(SelectSelectorConfig(options=["1 Phase", "3 Phasen"]))
        return fields

    async def async_step_device_fields(self, user_input=None):
        """Schritt 2: Entitäten, Sensoren und Ziele (dynamisch je Rolle)."""
        errors: dict[str, str] = {}
        if user_input is not None:
            if self._control_type == CONTROL_BUTTONS and not (
                _norm_entity(user_input.get("on_entity"))
                and _norm_entity(user_input.get("off_entity"))
            ):
                errors["base"] = "buttons_need_both"
            if self._control_type == CONTROL_BUTTONS and not _norm_entity(
                user_input.get("power_sensor")
            ):
                errors["base"] = "buttons_need_power"
            if not errors:
                device = self._build_device(user_input)
                if self._edit_id:
                    # Bestehende ID behalten → an Ort und Stelle ersetzen
                    for index, existing in enumerate(self._devices):
                        if existing["id"] == self._edit_id:
                            device["id"] = self._edit_id
                            self._devices[index] = device
                            break
                    else:
                        self._devices.append(device)
                else:
                    self._devices.append(device)
                await self._save()
                return await self.async_step_init(None)
        return self.async_show_form(
            step_id="device_fields",
            data_schema=vol.Schema(self._role_fields()),
            errors=errors,
        )

    def _role_fields(self) -> dict:
        """Alle Felder des Geräte-Formulars für die aktuelle Rolle."""
        prefill = self._prefill or {}
        sensors = prefill.get("sensors", {}) or {}
        car = prefill.get("car") or {}
        wp = prefill.get("wp") or {}
        limits = prefill.get("limits", {}) or {}
        fields: dict = {**self._control_fields()}

        if self._role == ROLE_WALLBOX:
            fields[vol.Optional("power_sensor", default=sensors.get("power") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False))
            )
            fields[vol.Optional("soc_sensor", default=sensors.get("soc") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False))
            )
            fields[vol.Required("capacity_kwh", default=car.get("capacity_kwh", 60.0))] = (
                NumberSelector(NumberSelectorConfig(
                    min=1, max=300, step=1, mode=NumberSelectorMode.BOX,
                    unit_of_measurement="kWh"))
            )
            fields[vol.Required("max_power_kw", default=(limits.get("power_limit_w", 11000) or 11000) / 1000.0)] = (
                NumberSelector(NumberSelectorConfig(
                    min=1.1, max=22, step=0.1, mode=NumberSelectorMode.BOX,
                    unit_of_measurement="kW"))
            )
            fields[vol.Required("min_soc", default=car.get("min_soc", 50))] = NumberSelector(
                NumberSelectorConfig(min=0, max=95, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="%")
            )
            fields[vol.Required("max_soc", default=car.get("max_soc", 80))] = NumberSelector(
                NumberSelectorConfig(min=30, max=100, step=1, mode=NumberSelectorMode.BOX, unit_of_measurement="%")
            )
            fields[vol.Required("grid_min", default=car.get("grid_min_allowed", True))] = BooleanSelector()
            fields[vol.Required("grid_deadline", default=car.get("grid_deadline_allowed", True))] = BooleanSelector()
        elif self._role == ROLE_WAERMEPUMPE:
            fields[vol.Optional("temp_sensor", default=sensors.get("temp") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False))
            )
            fields[vol.Optional("power_sensor", default=sensors.get("power") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False))
            )
            fields[vol.Required("est_power_kw", default=(wp.get("est_power_w", 2000) or 2000) / 1000.0)] = (
                NumberSelector(NumberSelectorConfig(
                    min=0.5, max=22, step=0.1, mode=NumberSelectorMode.BOX,
                    unit_of_measurement="kW"))
            )
            fields[vol.Required("comfort_c", default=wp.get("comfort_c", 60))] = NumberSelector(
                NumberSelectorConfig(min=40, max=70, step=0.5, mode=NumberSelectorMode.BOX, unit_of_measurement="°C")
            )
        else:  # Verbraucher
            fields[vol.Optional("power_sensor", default=sensors.get("power") or vol.UNDEFINED)] = (
                EntitySelector(EntitySelectorConfig(domain=_READ_DOMAINS, multiple=False))
            )
            fields[vol.Required("nominal_kw", default=(limits.get("nominal_power_w", 2000) or 2000) / 1000.0)] = (
                NumberSelector(NumberSelectorConfig(
                    min=0.1, max=22, step=0.1, mode=NumberSelectorMode.BOX,
                    unit_of_measurement="kW"))
            )
        return fields

    def _build_device(self, user_input: dict) -> dict:
        """Baut aus den Formular-Eingaben ein Geräte-Dict."""
        control = {}
        if self._control_type == CONTROL_BUTTONS:
            control = {
                "type": CONTROL_BUTTONS,
                "on_entity": _norm_entity(user_input.get("on_entity")),
                "off_entity": _norm_entity(user_input.get("off_entity")),
                "switch_entity": None,
                "number_entity": None,
                "number_unit": "W",
                "phases": 3,
            }
        elif self._control_type == CONTROL_SWITCH_NUMBER:
            control = {
                "type": CONTROL_SWITCH_NUMBER,
                "switch_entity": _norm_entity(user_input.get("switch_entity")),
                "number_entity": _norm_entity(user_input.get("number_entity")),
                "on_entity": None,
                "off_entity": None,
                "number_unit": str(user_input.get("number_unit", "W")),
                "phases": 3 if str(user_input.get("phases", "")) == "3 Phasen" else 1,
            }
        else:
            control = {
                "type": CONTROL_SWITCH,
                "switch_entity": _norm_entity(user_input.get("switch_entity")),
                "number_entity": None,
                "on_entity": None,
                "off_entity": None,
                "number_unit": "W",
                "phases": 3,
            }

        name = str(user_input.get("name", "")).strip() or "Gerät"
        device = default_device(self._role, name)
        device["control"] = control
        device["sensors"] = {
            "power": (
                _norm_entity(user_input.get("power_sensor"))
                if self._role != ROLE_WAERMEPUMPE or self._control_type == CONTROL_BUTTONS
                else None
            ),
            "soc": _norm_entity(user_input.get("soc_sensor")),
            "temp": _norm_entity(user_input.get("temp_sensor")),
        }
        if self._role == ROLE_WALLBOX:
            car = device["car"]
            car["capacity_kwh"] = float(user_input.get("capacity_kwh", 60) or 60)
            car["min_soc"] = float(user_input.get("min_soc", 50) or 50)
            car["max_soc"] = float(user_input.get("max_soc", 80) or 80)
            car["grid_min_allowed"] = bool(user_input.get("grid_min", True))
            car["grid_deadline_allowed"] = bool(user_input.get("grid_deadline", True))
            device["limits"]["power_limit_w"] = (
                float(user_input.get("max_power_kw", 11) or 11) * 1000.0
            )
        elif self._role == ROLE_WAERMEPUMPE:
            wp = device["wp"]
            wp["est_power_w"] = float(user_input.get("est_power_kw", 2) or 2) * 1000.0
            wp["comfort_c"] = float(user_input.get("comfort_c", 60) or 60)
            wp["grid_fallback_allowed"] = True
        else:
            device["limits"]["nominal_power_w"] = (
                float(user_input.get("nominal_kw", 2) or 2) * 1000.0
            )
        return device

    # ------------------------------------------------------------------
    # „Gefunden“ – Erkennungsvorschläge übernehmen
    # ------------------------------------------------------------------
    async def async_step_found(self, user_input=None):
        """Scannt und zeigt die gefundenen Messungen/Geräte an."""
        sets = suggest_sets(scan_entities(self.hass))
        self._found_sets = sets
        self._adopt_entities = {}
        self._adopt_options = []
        if not sets:
            return self.async_show_form(
                step_id="found_empty",
                data_schema=vol.Schema({}),
            )
        options = []
        for found in sets:
            if found["role"] in MEASURE_ROLES:
                options.append(f"Messung {MEASURE_LABELS[found['role']]}: {found['title']}")
            else:
                options.append(
                    f"Gerät {ROLE_LABELS.get(found['role'], found['role'])}: {found['title']}"
                )
        self._found_options = options
        if user_input is not None:
            label = str(user_input.get("entry", ""))
            try:
                index = options.index(label)
            except ValueError:
                return await self.async_step_found(None)
            found = self._found_sets[index]
            if found["role"] in MEASURE_ROLES:
                self._adopt_role = found["role"]
                candidates = self._candidates_for_role(found["role"])
                self._adopt_entities, adopt_options = _entity_options(candidates)
                self._adopt_options = adopt_options
                if not adopt_options:
                    return await self.async_step_found(None)
                return await self._show_adopt_measure()
            # Gerät: mit den gefundenen Feldern vorbelegt bearbeiten
            self._role = found["role"]
            self._edit_id = None
            prefill = default_device(found["role"], found.get("title", "Gerät"))
            fields = found.get("fields") or {}
            prefill["control"]["switch_entity"] = fields.get("switch_entity")
            prefill["control"]["on_entity"] = fields.get("on_entity")
            prefill["control"]["off_entity"] = fields.get("off_entity")
            prefill["control"]["number_entity"] = fields.get("number_entity")
            prefill["control"]["type"] = (
                CONTROL_BUTTONS
                if found.get("control") == "buttons"
                and fields.get("on_entity")
                and fields.get("off_entity")
                else CONTROL_SWITCH
            )
            prefill["sensors"]["power"] = fields.get("power_sensor")
            prefill["sensors"]["soc"] = fields.get("soc_sensor")
            prefill["sensors"]["temp"] = fields.get("temp_sensor")
            self._prefill = prefill
            if found.get("role") == ROLE_VERBRAUCHER:
                self._control_type = CONTROL_SWITCH
                return await self.async_step_device_fields(None)
            return await self.async_step_device_basics(None)
        return self.async_show_form(
            step_id="found",
            data_schema=vol.Schema(
                {
                    vol.Required("entry"): SelectSelector(
                        SelectSelectorConfig(options=options)
                    )
                }
            ),
        )

    async def async_step_found_empty(self, user_input=None):
        """Keine Vorschläge – zurück zum Menü."""
        return await self.async_step_init(None)

    def _candidates_for_role(self, role: str) -> list[dict]:
        """Top-Kandidaten für eine Messungs-Rolle (für die Übernahme)."""
        from .detector import candidates_for_role

        return candidates_for_role(scan_entities(self.hass), role, top_n=3)

    async def _show_adopt_measure(self):
        """Zeigt das Übernahme-Formular für eine Messungs-Rolle."""
        return self.async_show_form(
            step_id="adopt_measure",
            data_schema=vol.Schema(
                {
                    vol.Required("entity"): SelectSelector(
                        SelectSelectorConfig(options=list(self._adopt_options))
                    )
                }
            ),
        )

    async def async_step_adopt_measure(self, user_input=None):
        """Übernimmt einen gewählten Sensor als Messung."""
        if user_input is not None:
            entity_id = self._adopt_entities.get(str(user_input.get("entity", "")))
            if entity_id:
                self._energy[self._adopt_role + "_sensor"] = entity_id
                await self._save()
            return await self.async_step_init(None)
        return await self._show_adopt_measure()

    # ------------------------------------------------------------------
    # Erweiterte Einstellungen (globale Werte)
    # ------------------------------------------------------------------
    async def async_step_erweitert(self, user_input=None):
        """Globale Werte (Reserve, Zyklus, WP-Test) anpassen."""
        if user_input is not None:
            self._settings.update(
                {
                    "mode": MODE_TO_KEY.get(user_input.get("mode"), "auto"),
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
        schema = {
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
            vol.Required(
                "wp_test_target_c", default=settings.get("wp_test_target_c", 70)
            ): NumberSelector(
                NumberSelectorConfig(min=50, max=80, step=1, unit_of_measurement="°C")
            ),
            vol.Required(
                "wp_test_max_duration_min",
                default=settings.get("wp_test_max_duration_min", 120),
            ): NumberSelector(
                NumberSelectorConfig(min=10, max=600, step=10, unit_of_measurement="min")
            ),
        }
        return self.async_show_form(
            step_id="erweitert",
            data_schema=vol.Schema(schema),
        )
