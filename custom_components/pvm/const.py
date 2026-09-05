"""Konstanten, Standardwerte und Beschriftungen für die PVM-Integration.

Dieses Modul enthält ausschließlich reines Python (keine Home-Assistant-
Importe), damit es überall sicher importiert werden kann – auch in den
Logik-Modulen und Tests.
"""

DOMAIN = "pvm"
# Name in der HA-Seitenleiste (kompakt) und voller Produktname (Doku/Logs)
NAME = "PV Manager"
SIDEBAR_NAME = "PVM"
VERSION = "1.9.2"

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
CONTROL_SWITCH_NUMBER = "switch_number"  # Legacy: Schalter + Leistungs-Limit (wird zu switch + has_limiter)
CONTROL_BUTTONS = "buttons"              # Zwei Taster (Start/Stopp)
CONTROL_WP_TEMP = "wp_temp"              # Wärmepumpe: nur Ziel-Temperatur einstellbar (kein Ein/Aus)

CONTROL_TYPES = (CONTROL_SWITCH, CONTROL_SWITCH_NUMBER, CONTROL_BUTTONS, CONTROL_WP_TEMP)

CONTROL_LABELS = {
    CONTROL_SWITCH: "Ein Schalter (An/Aus)",
    CONTROL_SWITCH_NUMBER: "Schalter + Leistungs-/Strom-Begrenzung",
    CONTROL_BUTTONS: "Zwei Taster (Start/Stopp)",
    CONTROL_WP_TEMP: "Nur Ziel-Temperatur (kein Ein/Aus)",
}

# Netzanschluss-Variante (UI-Auswahl „Ein Sensor“ oder „Zwei getrennte“)
GRID_MODE_COMBINED = "combined"  # ein Sensor: Bezug + / Einspeisung − (oder invertiert)
GRID_MODE_SEPARATE = "separate"  # zwei getrennte Zähler (Bezug / Einspeisung)

GRID_MODE_LABELS = {
    GRID_MODE_COMBINED: "Ein Sensor (Bezug + / Einspeisung −)",
    GRID_MODE_SEPARATE: "Zwei getrennte Sensoren",
}

# Richtung des kombinierten Netz-Sensors
GRID_KIND_NET = "net"             # positiv = Bezug, negativ = Einspeisung
GRID_KIND_EXPORT = "export_only"  # nur Einspeisung, positiv = Einspeisung
GRID_KIND_INVERTED = "inverted"   # positiv = Einspeisung, negativ = Bezug (z. B. SolarNet)

GRID_KIND_LABELS = {
    GRID_KIND_NET: "Bezug positiv (+), Einspeisung negativ (−)",
    GRID_KIND_EXPORT: "Nur Einspeisung (positiv = Einspeisung)",
    GRID_KIND_INVERTED: "Invertiert (Einspeisung positiv (+), Bezug negativ (−))",
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



# Wärmepumpe (Speichertemperatur in °C)
# Sicherheit & Hygiene: Der Speicher sollte nie dauerhaft unter 60 °C liegen
# (Legionellen-Risiko) – deshalb beginnt der Notfall-Minimum-Regler bei 60 °C.
WP_TEMP_MIN_C = 40.0       # untere Skalengrenze aller WP-Temperatur-Regler
WP_TEMP_MAX_C = 80.0       # obere Skalengrenze (unnötig heiß für die Heizung)
WP_COMFORT_ZONE_LO_C = 55.0  # unterhalb: Bakterien-/Legionellen-Gefahr
WP_COMFORT_ZONE_HI_C = 70.0  # oberhalb: unnötig heiß / schlecht für die Heizung
DEFAULT_WP_TARGET_C = 60.0
DEFAULT_WP_SAFETY_MIN_C = 60.0   # Notfall-Minimum: mindestens 60 °C (Legionellen)
DEFAULT_WP_EST_POWER_W = 2000.0
DEFAULT_WP_HYSTERESIS_C = 2.0
# Ziel-Temperatur, auf die PVM die WP bei Überschuss anhebt („Boosten“)
DEFAULT_WP_BOOST_C = 65.0

# Verbraucher
DEFAULT_CONSUMER_NOMINAL_W = 2000.0

# PV-Prognose (vorausschauende Regelung)
# Standard: AUS. Die Prognose erscheint erst, wenn sie in den Einstellungen
# eingeschaltet wird (optional mit eigenem API-Schlüssel für höhere Auflösung).
FORECAST_ENABLED_DEFAULT = False
FORECAST_REFRESH_S = 900               # alle 15 min aktualisieren
FORECAST_SERIES_MIN = 15               # 15-Minuten-Auflösung der Kurve
FORECAST_HORIZON_S = 3 * 3600          # Kurve: nächste 3 Stunden
FORECAST_HOUSE_AVG_S = 24 * 3600       # Hausverbrauchs-Mittel über 24 h
# Ab dieser erwarteten PV-Lücke (kWh, Rest des Tages) wird „vorausschauendes
# Laden“ aktiv – das Auto lädt dann schon am Tag, statt spät abends.
PRE_CHARGE_DEFICIT_KWH = 2.0

# Zeitgrenzen
MAX_DEADLINE_DAYS_AHEAD = 7
# Sensoren gelten nach dieser Zeit als "ungültig" (Zustand wird gehalten).
# Großzügig gewählt: Viele PV-/Netz-Integrationen (Modbus, SolarNet …)
# aktualisieren nur alle 1–5 Minuten – kürzere Fenster ließen den
# Überschuss ständig „ungültig“ werden (Sensoren schienen kaputt).
STALE_SENSOR_AFTER_S = 300.0  # 5 min (Überschuss/Leistung)
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
REASON_ON_SCHEDULE = "on_schedule"
REASON_ON_WP_SAFETY = "on_wp_safety"
REASON_OFF_TARGET = "off_target"
REASON_OFF_NO_SURPLUS = "off_no_surplus"
REASON_OFF_PRIORITY = "off_priority"
REASON_OFF_MODE = "off_mode"
REASON_OFF_MANUAL = "off_manual"
REASON_HOLD = "hold"
REASON_HOLD_FORECAST = "hold_forecast"
REASON_NO_DATA = "no_data"

REASON_LABELS = {
    REASON_ON_SURPLUS: "Überschuss vorhanden",
    REASON_ON_DEADLINE: "Frist-Ziel aktiv",
    REASON_ON_MANUAL: "Power Charge aktiv",
    REASON_ON_MIN_SOC: "Mindest-SOC wird geladen",
    REASON_ON_SCHEDULE: "Kalender-Zeitfenster aktiv",
    REASON_ON_WP_SAFETY: "Sicherheits-Minimum unterschritten",
    REASON_OFF_TARGET: "Ziel erreicht",
    REASON_OFF_NO_SURPLUS: "Kein Überschuss mehr",
    REASON_OFF_PRIORITY: "Priorität gewechselt",
    REASON_OFF_MODE: "Modus geändert",
    REASON_OFF_MANUAL: "Manuell gestoppt",
    REASON_HOLD: "Zustand gehalten (Messung ungültig)",
    REASON_HOLD_FORECAST: "Kurze Wolkenphase – läuft weiter (Prognose)",
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
        "grid_mode": GRID_MODE_COMBINED, # Anschluss-Variante (combined/separate)
        "grid_kind": GRID_KIND_NET,
    },
    "settings": {
        "mode": DEFAULT_MODE,
        "reserve_w": DEFAULT_RESERVE_W,
        "cycle_s": DEFAULT_CYCLE_S,
        "min_on_s": DEFAULT_MIN_ON_S,
        "min_off_s": DEFAULT_MIN_OFF_S,
        "ui_theme": DEFAULT_UI_THEME,
        # Deine Farbe (ersetzt das HA-Blau): "auto" = Theme-Standard,
        # "custom" = freie Farbe aus accent_custom (Hex, z. B. "#ff9f1c")
        "accent": "auto",
        "accent_custom": "",
        # Tutorial/Einführung auf der Startseite beendet (vom Nutzer per Button)
        "intro_done": False,
        # Automatische Auto-Erkennung (welches Auto lädt wo): standardmäßig AUS –
        # die Zuordnung kommt dann aus der manuell gewählten Heimat-Wallbox.
        "auto_pairing": False,
        # Manueller Modus: PVM steuert nichts, misst aber weiter (Monitor).
        "manual_mode": False,
        # PV-Prognose & vorausschauende Regelung (Standard: aus, optional
        # mit eigenem API-Schlüssel – dann höher aufgelöst)
        "forecast_enabled": FORECAST_ENABLED_DEFAULT,
        "forecast_api_key": "",
        "pre_charge": True,
    },
    "devices": [],
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
    # Nummern-Zusätze (Feintuning im Dashboard)
    "power_limit": "Max. Ladeleistung",
    "min_on_power": "Mindest-Überschuss zum Laden",
    "safety": "Notfall-Temperatur (Minimum)",
    "nominal": "Leistung im Betrieb",
    "boost": "Ziel-Temperatur bei Überschuss",
}
