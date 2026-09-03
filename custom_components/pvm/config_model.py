"""Konfigurations-Modell für PVM (reines Python).

Definiert, wie Geräte und Einstellungen im Store aussehen, und normalisiert
gespeicherte Daten (z. B. nach Updates oder manuellen Eingriffen).
"""

from __future__ import annotations

import copy
import uuid

from .const import (
    CONTROL_BUTTONS,
    CONTROL_SWITCH,
    CONTROL_SWITCH_NUMBER,
    CONTROL_TYPES,
    DEFAULT_CAPACITY_KWH,
    DEFAULT_CONFIG,
    DEFAULT_CONSUMER_NOMINAL_W,
    DEFAULT_MAX_SOC,
    DEFAULT_MIN_CHARGE_POWER_W,
    DEFAULT_MIN_ON_POWER_W,
    DEFAULT_MIN_SOC,
    DEFAULT_PHASES,
    DEFAULT_POWER_LIMIT_W,
    DEFAULT_UI_THEME,
    DEFAULT_WP_EST_POWER_W,
    DEFAULT_WP_SAFETY_MIN_C,
    DEFAULT_WP_TARGET_C,
    GRID_KIND_NET,
    MODE_AUTO,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
    SETUP_BEREIT,
    SETUP_MESSUNGEN,
    SETUP_START,
    UI_THEMES,
)

# Erlaubte Rollen/Modi (Vermeidet kaputte Daten durch Tippfehler)
VALID_ROLES = (ROLE_WALLBOX, ROLE_WAERMEPUMPE, ROLE_VERBRAUCHER)
VALID_MODES = ("auto", "surplus", "deadline", "off")
VALID_GRID_KINDS = ("net", "export_only")

# Zahlengrenzen je Schlüssel
LIMITS = {
    "min_soc": (0.0, 100.0),
    "max_soc": (10.0, 100.0),
    "deadline_soc": (0.0, 100.0),
    "comfort_c": (40.0, 70.0),
    "safety_min_c": (20.0, 50.0),
    "capacity_kwh": (1.0, 300.0),
    "power_limit_w": (100.0, 22000.0),
    "min_on_power_w": (100.0, 11000.0),
    "min_charge_power_w": (500.0, 22000.0),
    "nominal_power_w": (50.0, 22000.0),
    "min_on_s": (30.0, 3600.0),
    "min_off_s": (10.0, 3600.0),
    "cycle_s": (10.0, 300.0),
    "reserve_w": (0.0, 5000.0),
}

# Geräte-Grenzen (Settings-Grenzen oben mitgenutzt)
LIMITS["phases"] = (1.0, 3.0)


def _clamp(value, limits):
    """Begrenzt einen Wert auf ein (min, max)-Tupel; None bei Unsinn."""
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    lo, hi = limits
    return max(lo, min(hi, value))


def _clean(value):
    """Konvertiert einen Wert in float oder entfernt ihn."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def default_device(role: str, name: str = "Gerät") -> dict:
    """Erzeugt ein Gerät mit sinnvollen Standardwerten für die Rolle."""
    device = {
        "id": uuid.uuid4().hex[:10],
        "name": name,
        "role": role,
        "enabled": True,
        "control": {
            "type": CONTROL_SWITCH,
            "switch_entity": None,
            "number_entity": None,
            "on_entity": None,   # Zwei Taster: Start-Taster
            "off_entity": None,  # Zwei Taster: Stopp-Taster
            "number_unit": "W",
            "phases": DEFAULT_PHASES,
        },
        "sensors": {
            "power": None,   # Lade-/Verbrauchsleistung
            "soc": None,     # E-Auto (SoC-Sensor)
            "temp": None,    # Wärmepumpe
        },
        "limits": {
            "power_limit_w": DEFAULT_POWER_LIMIT_W,
            "min_on_power_w": DEFAULT_MIN_ON_POWER_W,
            "min_on_s": 120.0,
            "min_off_s": 60.0,
        },
        "car": None,
        "wp": None,
    }
    if role == ROLE_WALLBOX:
        device["car"] = {
            "capacity_kwh": DEFAULT_CAPACITY_KWH,
            "min_soc": DEFAULT_MIN_SOC,
            "max_soc": DEFAULT_MAX_SOC,
            "min_charge_power_w": DEFAULT_MIN_CHARGE_POWER_W,
            "grid_min_allowed": True,
            "grid_deadline_allowed": True,
            "manual_force": False,
            "deadline_time": None,  # "HH:MM" oder None
            "deadline_soc": 0.0,    # 0 = deaktiviert
        }
    elif role == ROLE_WAERMEPUMPE:
        device["wp"] = {
            "comfort_c": DEFAULT_WP_TARGET_C,
            "safety_min_c": DEFAULT_WP_SAFETY_MIN_C,
            "est_power_w": DEFAULT_WP_EST_POWER_W,
            "grid_fallback_allowed": True,
            "test_active": False,
        }
    else:  # Verbraucher
        device["limits"]["nominal_power_w"] = DEFAULT_CONSUMER_NOMINAL_W
    return device


def _merge(default: dict, data: dict | None) -> dict:
    """Führt gespeicherte Daten rekursiv mit Defaults zusammen."""
    if not isinstance(data, dict):
        data = {}
    out = copy.deepcopy(default)
    for key, value in data.items():
        if key in out and isinstance(out[key], dict) and isinstance(value, dict):
            out[key] = _merge(out[key], value)
        elif value is not None:
            out[key] = value
    return out


def normalize_device(device: dict) -> dict:
    """Normalisiert ein einzelnes Gerät und begrenzt Zahlenwerte."""
    if not isinstance(device, dict):
        device = {}
    role = device.get("role")
    if role not in VALID_ROLES:
        role = ROLE_VERBRAUCHER
    name = str(device.get("name") or "Gerät").strip() or "Gerät"

    merged = _merge(default_device(role, name), device)
    merged["id"] = str(merged.get("id") or uuid.uuid4().hex[:10]).strip()
    merged["name"] = name
    merged["role"] = role
    merged["enabled"] = bool(merged.get("enabled", True))

    # Steuerung
    control = merged.setdefault("control", {})
    if control.get("type") not in CONTROL_TYPES:
        control["type"] = CONTROL_SWITCH
    for key in ("switch_entity", "number_entity", "on_entity", "off_entity"):
        control[key] = control.get(key) or None
    # Unvollständige/kaputte Steuerungen auf sichere Varianten zurückstufen
    if control["type"] == CONTROL_BUTTONS and not (
        control.get("on_entity") and control.get("off_entity")
    ):
        control["type"] = CONTROL_SWITCH
    if control["type"] == CONTROL_SWITCH_NUMBER and not control.get("number_entity"):
        control["type"] = CONTROL_SWITCH
    if control.get("number_unit") not in ("W", "kW", "A", "mA"):
        control["number_unit"] = "W"
    control["phases"] = int(_clean(control.get("phases", DEFAULT_PHASES)) or DEFAULT_PHASES)
    control["phases"] = 3 if control["phases"] == 3 else 1

    # Sensoren
    sensors = merged.setdefault("sensors", {})
    for key in ("power", "soc", "temp"):
        sensors[key] = sensors.get(key) or None

    # Limits
    limits = merged.setdefault("limits", {})
    for key, bounds in LIMITS.items():
        if key in limits:
            value = _clean(limits[key])
            limits[key] = _clamp(value, bounds)

    # Auto
    car = merged.get("car")
    if car is not None and isinstance(car, dict):
        car["capacity_kwh"] = _clamp(_clean(car.get("capacity_kwh")), (1.0, 300.0))
        car["min_soc"] = _clamp(_clean(car.get("min_soc")), (0.0, 100.0))
        car["max_soc"] = _clamp(_clean(car.get("max_soc")), (10.0, 100.0))
        car["min_soc"] = min(car["min_soc"], car["max_soc"] - 5.0)
        car["max_soc"] = max(car["max_soc"], car["min_soc"] + 5.0)
        dsoc = _clean(car.get("deadline_soc"))
        car["deadline_soc"] = _clamp(dsoc, (0.0, car["max_soc"]))
        car["min_charge_power_w"] = _clamp(
            _clean(car.get("min_charge_power_w")), (500.0, 22000.0)
        )
        car["grid_min_allowed"] = bool(car.get("grid_min_allowed", True))
        car["grid_deadline_allowed"] = bool(car.get("grid_deadline_allowed", True))
        car["manual_force"] = bool(car.get("manual_force", False))
        deadline_time = car.get("deadline_time")
        car["deadline_time"] = str(deadline_time) if deadline_time else None
    else:
        merged["car"] = None

    # Wärmepumpe
    wp = merged.get("wp")
    if wp is not None and isinstance(wp, dict):
        wp["comfort_c"] = _clamp(_clean(wp.get("comfort_c")), (40.0, 70.0))
        wp["safety_min_c"] = _clamp(_clean(wp.get("safety_min_c")), (20.0, 50.0))
        wp["est_power_w"] = _clamp(_clean(wp.get("est_power_w")), (50.0, 22000.0))
        wp["grid_fallback_allowed"] = bool(wp.get("grid_fallback_allowed", True))
        wp["test_active"] = bool(wp.get("test_active", False))
    else:
        merged["wp"] = None

    # Verbraucher-Limit
    if role == ROLE_VERBRAUCHER:
        limits.setdefault("nominal_power_w", DEFAULT_CONSUMER_NOMINAL_W)
        limits["nominal_power_w"] = _clamp(
            _clean(limits.get("nominal_power_w")), (50.0, 22000.0)
        )

    return merged


def normalize_config(data: dict | None) -> dict:
    """Normalisiert die komplette gespeicherte Konfiguration."""
    merged = _merge(DEFAULT_CONFIG, data)

    energy = merged.setdefault("energy", {})
    for key in ("pv_sensor", "grid_sensor", "house_sensor"):
        energy[key] = energy.get(key) or None
    if energy.get("grid_kind") not in VALID_GRID_KINDS:
        energy["grid_kind"] = GRID_KIND_NET

    settings = merged.setdefault("settings", {})
    for key, bounds in LIMITS.items():
        if key in settings:
            settings[key] = _clamp(_clean(settings[key]), bounds)
    if settings.get("mode") not in VALID_MODES:
        settings["mode"] = MODE_AUTO
    if settings.get("ui_theme") not in UI_THEMES:
        settings["ui_theme"] = DEFAULT_UI_THEME
    defaults = DEFAULT_CONFIG["settings"]
    for key, value in settings.items():
        if value is None and key in defaults:
            settings[key] = defaults[key]

    devices = []
    seen = set()
    for device in merged.get("devices", []) or []:
        normalized = normalize_device(device)
        if normalized["id"] not in seen:
            seen.add(normalized["id"])
            devices.append(normalized)
    merged["devices"] = devices

    results = merged.get("wp_test_results") or {}
    merged["wp_test_results"] = {str(k): v for k, v in results.items()}
    return merged


def find_device(config: dict, device_id: str) -> dict | None:
    """Liefert das Gerät mit der ID (oder None)."""
    for device in config.get("devices", []):
        if device.get("id") == device_id:
            return device
    return None


def energy_configured(config: dict | None) -> bool:
    """Sind überhaupt Energiemessungen (PV/Netz/Haus) konfiguriert?"""
    if not isinstance(config, dict):
        return False
    energy = config.get("energy") or {}
    return bool(
        energy.get("pv_sensor") or energy.get("grid_sensor") or energy.get("house_sensor")
    )


def setup_stage(config: dict | None) -> str:
    """Einrichtungs-Stufe für Tutorial/Status (start → messungen → bereit)."""
    if not isinstance(config, dict):
        return SETUP_START
    if config.get("devices"):
        return SETUP_BEREIT
    if energy_configured(config):
        return SETUP_MESSUNGEN
    return SETUP_START


def deadline_next_ts(now_local, deadline_time: str | None) -> float | None:
    """Nächster Zeitstempel (UTC-Epoch) für eine Uhrzeit „HH:MM“.

    Liefert den heutigen Termin, falls er noch kommt, sonst den morgigen.
    ``now_local`` muss eine zeitzonen-lokale datetime sein.
    """
    if not deadline_time:
        return None
    try:
        hours, minutes = deadline_time.split(":")
        hours = int(hours) % 24
        minutes = int(minutes) % 60
    except (ValueError, AttributeError):
        return None

    from datetime import timedelta

    candidate = now_local.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    if candidate <= now_local:
        candidate = candidate + timedelta(days=1)
    return candidate.timestamp()
