"""Konstanten, Standardwerte und Beschriftungen für die PVM-Integration.

Dieses Modul enthält ausschließlich reines Python (keine Home-Assistant-
Importe), damit es überall sicher importiert werden kann – auch in den
Logik-Modulen und Tests.
"""

DOMAIN = "pvm"
NAME = "PV Manager"
VERSION = "1.3.0"

# Von der Integration bereitgestellte Plattformen.
PLATFORMS = ["sensor", "number", "switch", "button", "select", "time"]

# Speicher (JSON-Store) für die gesamte Konfiguration.
STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1

# UI-Designs des Dashboards (umschaltbar im Dashboard)
UI_THEME_HA = "ha"               # folgt dem Home-Assistant-Design/-Theme
UI_THEME_SUNRISE = "sonnenaufgang"
UI_THEME_NATURE = "natur"
UI_THEME_COOL = "klar"
UI_THEMES = (UI_THEME_HA, UI_THEME_SUNRISE, UI_THEME_NATURE, UI_THEME_COOL)
UI_THEME_LABELS = {
    UI_THEME_HA: "🏠 Home Assistant",
    UI_THEME_SUNRISE: "☀️ Sonnenaufgang",
    UI_THEME_NATURE: "🌿 Natur-frisch",
    UI_THEME_COOL: "🌊 Kühl & klar",
}
DEFAULT_UI_THEME = UI_THEME_HA

# Einrichtungs-Stufen (Setup-Status-Sensor)
SETUP_START = "start"       # noch keine Messungen/Geräte
SETUP_MESSUNGEN = "messungen"  # Messungen da, noch keine Geräte
SETUP_BEREIT = "bereit"     # Geräte konfiguriert
SETUP_LABELS = {
    SETUP_START: "Erste Schritte",
    SETUP_MESSUNGEN: "Messungen – jetzt Geräte hinzufügen",
    SETUP_BEREIT: "Bereit",
}

# ---------------------------------------------------------------------------
# Geräte-Rollen
# ---------------------------------------------------------------------------
ROLE_WALLBOX = "wallbox"          # Wallbox mit optionalem Auto-Profil
ROLE_WAERMEPUMPE = "waermepumpe"  # Wärmepumpe
ROLE_VERBRAUCHER = "verbraucher"  # Sonstige schaltbare Verbraucher
ROLE_FAHRZEUG = "fahrzeug"        # E-Auto (nur Überwachung: SoC, Ladeleistung)

ROLES = (ROLE_WALLBOX, ROLE_WAERMEPUMPE, ROLE_VERBRAUCHER, ROLE_FAHRZEUG)

ROLE_LABELS = {
    ROLE_WALLBOX: "Wallbox (E-Auto)",
    ROLE_WAERMEPUMPE: "Wärmepumpe",
    ROLE_VERBRAUCHER: "Verbraucher",
    ROLE_FAHRZEUG: "Auto (E-Auto)",
}

ROLE_ICONS = {
    ROLE_WALLBOX: "mdi:ev-station",
    ROLE_WAERMEPUMPE: "mdi:heat-pump",
    ROLE_VERBRAUCHER: "mdi:power-plug",
    ROLE_FAHRZEUG: "mdi:car",
}

# Steuerungsarten pro Gerät
CONTROL_SWITCH = "switch"                # Ein Schalter (an/aus)
CONTROL_SWITCH_NUMBER = "switch_number"  # Schalter + Leistungs-/Strom-Limit
CONTROL_BUTTONS = "buttons"              # Zwei Taster (Start/Stopp)

CONTROL_TYPES = (CONTROL_SWITCH, CONTROL_SWITCH_NUMBER, CONTROL_BUTTONS)

CONTROL_LABELS = {
    CONTROL_SWITCH: "Ein Schalter (An/Aus)",
    CONTROL_SWITCH_NUMBER: "Schalter + Leistungs-/Strom-Begrenzung",
    CONTROL_BUTTONS: "Zwei Taster (Start/Stopp)",
}

# Energiesensor-Typen für den Netz-Sensor
GRID_KIND_NET = "net"             # Import positiv, Export negativ
GRID_KIND_EXPORT = "export_only"  # nur Einspeisung, positiv = Export

GRID_KIND_LABELS = {
    GRID_KIND_NET: "Kombiniert (Bezug +, Einspeisung −)",
    GRID_KIND_EXPORT: "Nur Einspeisung (positiv = Einspeisung)",
}

# Betriebsmodi (globaler Select)
MODE_AUTO = "auto"              # Alles aktiv: Überschuss + Fristen + Mindest-SOC
MODE_SURPLUS = "surplus"        # Nur PV-Überschuss (kein Netzstrom)
MODE_DEADLINE = "deadline"      # Nur Frist- und Mindest-Ziele (kein Überschuss-Laden)
MODE_OFF = "off"                # Keine automatische Steuerung

MODES = (MODE_AUTO, MODE_SURPLUS, MODE_DEADLINE, MODE_OFF)

MODE_LABELS = {
    MODE_AUTO: "Auto (Überschuss + Ziele)",
    MODE_SURPLUS: "Nur Überschuss (kein Netzstrom)",
    MODE_DEADLINE: "Nur Ziele (Fristen/Mindest-SOC)",
    MODE_OFF: "Aus",
}

# ---------------------------------------------------------------------------
# Standardwerte
# ---------------------------------------------------------------------------
DEFAULT_RESERVE_W = 100       # Einspeise-Reserve in Watt
DEFAULT_CYCLE_S = 30          # Abstand zwischen zwei Steuerzyklen
DEFAULT_MIN_ON_S = 120        # Mindest-Einschaltdauer (Antiflackern)
DEFAULT_MIN_OFF_S = 60        # Mindest-Ausschaltdauer (Antiflackern)
DEFAULT_MODE = MODE_AUTO

# Wallbox / Auto
DEFAULT_CAPACITY_KWH = 60.0
DEFAULT_MIN_SOC = 50.0
DEFAULT_MAX_SOC = 80.0
DEFAULT_POWER_LIMIT_W = 11000.0
DEFAULT_MIN_ON_POWER_W = 1400.0  # unter dieser Leistung lohnt Laden nicht
DEFAULT_MIN_CHARGE_POWER_W = 4000.0  # Netz-Leistung für Mindest-SOC
DEFAULT_PHASES = 3
PHASE_VOLTAGE_V = 230.0

# Wärmepumpe
DEFAULT_WP_TARGET_C = 60.0
DEFAULT_WP_SAFETY_MIN_C = 40.0
DEFAULT_WP_EST_POWER_W = 2000.0
DEFAULT_WP_HYSTERESIS_C = 2.0

# Verbraucher
DEFAULT_CONSUMER_NOMINAL_W = 2000.0

# WP-Kalibrierung (Testlauf)
WP_TEST_TARGET_C = 70.0
WP_TEST_MAX_DURATION_MIN = 120
WP_TEST_SAMPLE_INTERVAL_S = 10
WP_TEST_DISTURBANCE_W = 500.0

# Zeitgrenzen
MAX_DEADLINE_DAYS_AHEAD = 7
# Sensoren gelten nach dieser Zeit als "ungültig" (Zustand wird gehalten).
STALE_SENSOR_AFTER_S = 2 * DEFAULT_CYCLE_S + 30  # ~90 s (Überschuss/Leistung)
STALE_SOC_AFTER_S = 1800.0  # SoC-Sensoren aktualisieren oft nur alle paar Minuten
STALE_TEMP_AFTER_S = 600.0  # Temperaturmessungen (WP)
STALE_CONTROL_AFTER_S = 600.0  # Schalter-/Nummern-Entitäten (kein aktives Polling)

# Sicherheit: nie mehr als 30 s auf den Koordinator warten
CYCLE_TIMEOUT_S = 30

# Engine-Fehlerzähler
MAX_CONSECUTIVE_ERRORS = 3
ENGINE_RESTART_DELAY_S = 300

# ---------------------------------------------------------------------------
# Gründe (Reason-Codes) der Steuer-Engine – deutsch für das UI
# ---------------------------------------------------------------------------
REASON_ON_SURPLUS = "on_surplus"
REASON_ON_DEADLINE = "on_deadline"
REASON_ON_MANUAL = "on_manual"
REASON_ON_MIN_SOC = "on_min_soc"
REASON_ON_WP_TEST = "on_wp_test"
REASON_ON_WP_SAFETY = "on_wp_safety"
REASON_OFF_TARGET = "off_target"
REASON_OFF_NO_SURPLUS = "off_no_surplus"
REASON_OFF_PRIORITY = "off_priority"
REASON_OFF_MODE = "off_mode"
REASON_OFF_MANUAL = "off_manual"
REASON_HOLD = "hold"
REASON_NO_DATA = "no_data"

REASON_LABELS = {
    REASON_ON_SURPLUS: "Überschuss vorhanden",
    REASON_ON_DEADLINE: "Frist-Ziel aktiv",
    REASON_ON_MANUAL: "Power Charge aktiv",
    REASON_ON_MIN_SOC: "Mindest-SOC wird geladen",
    REASON_ON_WP_TEST: "WP-Test läuft",
    REASON_ON_WP_SAFETY: "Sicherheits-Minimum unterschritten",
    REASON_OFF_TARGET: "Ziel erreicht",
    REASON_OFF_NO_SURPLUS: "Kein Überschuss mehr",
    REASON_OFF_PRIORITY: "Priorität gewechselt",
    REASON_OFF_MODE: "Modus geändert",
    REASON_OFF_MANUAL: "Manuell gestoppt",
    REASON_HOLD: "Zustand gehalten (Messung ungültig)",
    REASON_NO_DATA: "Keine Messwerte",
}

# ---------------------------------------------------------------------------
# Standard-Konfiguration (leere Installation)
# ---------------------------------------------------------------------------
DEFAULT_CONFIG = {
    "energy": {
        "pv_sensor": None,
        "grid_sensor": None,             # Kombiniert (Bezug +, Einspeisung −)
        "grid_import_sensor": None,      # Separater Netzbezug (positiv = Bezug)
        "grid_export_sensor": None,      # Separate Einspeisung (positiv = Einspeisung)
        "house_sensor": None,
        "battery_power_sensor": None,    # Speicher-Leistung (optional)
        "battery_soc_sensor": None,      # Speicher-SoC in % (optional)
        "grid_kind": GRID_KIND_NET,
    },
    "settings": {
        "mode": DEFAULT_MODE,
        "reserve_w": DEFAULT_RESERVE_W,
        "cycle_s": DEFAULT_CYCLE_S,
        "min_on_s": DEFAULT_MIN_ON_S,
        "min_off_s": DEFAULT_MIN_OFF_S,
        "wp_test_target_c": WP_TEST_TARGET_C,
        "wp_test_max_duration_min": WP_TEST_MAX_DURATION_MIN,
        "wp_test_disturbance_w": WP_TEST_DISTURBANCE_W,
        "ui_theme": DEFAULT_UI_THEME,
    },
    "devices": [],
    # WP-Test-Ergebnisse (dauerhaft, damit nach Neustart noch abrufbar)
    "wp_test_results": {},
}

# Beschriftungen für die Geräte-Entitäten (deutsch) – Schlüssel = Entitäten-Typ
ENTITY_LABELS = {
    "auto": "Automatik (Überschuss)",
    "power_charge": "Power Charge",
    "grid_min": "Netz für Mindest-SOC",
    "grid_deadline": "Netz für Frist-Ziel",
    "grid_fallback": "Netz im Notfall (Minimaltemperatur)",
    "comfort": "Soll-Temperatur",
    "min_soc": "Mindest-SOC",
    "max_soc": "Max-SOC",
    "deadline_soc": "Frist-Ziel-SOC",
    "deadline_time": "Frist-Zeit",
    "rank": "Priorität (Rang)",
    "status": "Status",
    "up": "Priorität erhöhen",
    "down": "Priorität senken",
    "test_start": "WP-Test starten",
    "test_abort": "WP-Test abbrechen",
    "wp_test_result": "Letzter WP-Test",
    # Nummern-Zusätze (Feintuning im Dashboard)
    "power_limit": "Max. Ladeleistung",
    "min_on_power": "Mindest-Überschuss zum Laden",
    "safety": "Notfall-Temperatur (Minimum)",
    "nominal": "Leistung im Betrieb",
}
