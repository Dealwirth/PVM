"""Konstanten für die PVM-Integration."""

DOMAIN = "pvm"
VERSION = "1.0.0"

# Standardprioritäten (1 = niedrig, 10 = hoch)
DEFAULT_PRIORITIES = {
    "wallbox": 8,
    "waermepumpe": 5,
    "verbraucher": 3,
}

# Standardziele für Autos (in kWh)
DEFAULT_CAR_TARGETS = {
    "mindest_kwh": 10.0,
    "max_kwh": 80.0,  # in Prozent
}

# WP-Test-Standards
WP_TEST_DEFAULTS = {
    "soll_temperatur": 70,
    "max_dauer_minuten": 120,
    "mess_intervall_sekunden": 10,
    "störungs_schwelle_watt": 500,
}

# Gerätetypen-Registry (wird zur Laufzeit erweitert)
DEVICE_TYPES = {
    "wallbox": "Wallbox",
    "waermepumpe": "Wärmepumpe",
    "verbraucher": "Verbraucher",
    "auto": "Auto",
}

# Sensor-Mapping für automatische Erkennung
SENSOR_MAPPING = {
    "pv_power": ["sensor.pv_leistung", "sensor.solar_power"],
    "wp_temperature": ["sensor.waermepumpe_temperatur", "sensor.heatpump_temperature"],
    "car_soc": ["sensor.auto_soc", "sensor.car_battery"],
    "wallbox_power": ["sensor.wallbox_leistung", "sensor.wallbox_power"],
}

# Fehlerschwellen für Neustart der Engine
MAX_CONSECUTIVE_ERRORS = 3