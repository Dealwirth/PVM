"""Tests für das Konfigurations-Modell."""

from datetime import UTC, datetime

from custom_components.pvm import config_model as cm
from custom_components.pvm.const import (
    CONTROL_BUTTONS,
    CONTROL_SWITCH,
    DEFAULT_CONFIG,
    DEFAULT_UI_THEME,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
    SETUP_BEREIT,
    SETUP_MESSUNGEN,
    SETUP_START,
)


def test_empty_config_normalizes():
    config = cm.normalize_config(None)
    assert config["devices"] == []
    assert config["settings"]["mode"] == "auto"
    assert config["energy"]["pv_sensor"] is None


def test_default_config_roundtrip():
    config = cm.normalize_config(DEFAULT_CONFIG)
    assert config == cm.normalize_config(config)


def test_wallbox_defaults():
    device = cm.normalize_device(cm.default_device(ROLE_WALLBOX, "Auto 1"))
    assert device["role"] == ROLE_WALLBOX
    assert device["car"]["min_soc"] == 50.0
    assert device["car"]["max_soc"] == 80.0
    assert device["car"]["deadline_soc"] == 0.0
    assert device["sensors"]["soc"] is None


def test_min_soc_clamped_below_max():
    device = cm.default_device(ROLE_WALLBOX, "Auto 1")
    device["car"]["min_soc"] = 95.0
    device["car"]["max_soc"] = 80.0
    normalized = cm.normalize_device(device)
    assert normalized["car"]["min_soc"] <= normalized["car"]["max_soc"] - 5.0


def test_wp_defaults():
    device = cm.normalize_device(cm.default_device(ROLE_WAERMEPUMPE, "WP"))
    assert device["wp"]["comfort_c"] == 60.0
    assert device["wp"]["safety_min_c"] == 40.0


def test_consumer_defaults():
    device = cm.normalize_device(cm.default_device(ROLE_VERBRAUCHER, "Waschmaschine"))
    assert device["limits"]["nominal_power_w"] == 2000.0
    assert device["car"] is None and device["wp"] is None


def test_invalid_role_falls_back():
    device = cm.normalize_device({"id": "x", "role": "u-boot", "name": "N"})
    assert device["role"] == ROLE_VERBRAUCHER


def test_two_button_control_normalized():
    device = cm.default_device(ROLE_WALLBOX, "Auto 1")
    device["control"] = {
        "type": CONTROL_BUTTONS,
        "on_entity": "button.wallbox_start",
        "off_entity": "button.wallbox_stop",
    }
    normalized = cm.normalize_device(device)
    assert normalized["control"]["type"] == CONTROL_BUTTONS
    assert normalized["control"]["on_entity"] == "button.wallbox_start"
    assert normalized["control"]["off_entity"] == "button.wallbox_stop"


def test_incomplete_two_buttons_falls_back_to_switch():
    device = cm.default_device(ROLE_WAERMEPUMPE, "WP")
    device["control"] = {
        "type": CONTROL_BUTTONS,
        "on_entity": None,
        "off_entity": "button.wp_stop",
    }
    normalized = cm.normalize_device(device)
    assert normalized["control"]["type"] == CONTROL_SWITCH


def test_theme_default_and_invalid_value():
    config = cm.normalize_config(None)
    assert config["settings"]["ui_theme"] == DEFAULT_UI_THEME
    bad = cm.normalize_config({"settings": {"ui_theme": "neon"}})
    assert bad["settings"]["ui_theme"] == DEFAULT_UI_THEME


def test_setup_stages():
    assert cm.setup_stage(None) == SETUP_START
    empty = {"energy": {}, "devices": []}
    assert cm.setup_stage(empty) == SETUP_START
    with_energy = {"energy": {"pv_sensor": "sensor.pv"}, "devices": []}
    assert cm.setup_stage(with_energy) == SETUP_MESSUNGEN
    with_device = {
        "energy": {"pv_sensor": "sensor.pv"},
        "devices": [cm.default_device(ROLE_WALLBOX, "Auto 1")],
    }
    assert cm.setup_stage(with_device) == SETUP_BEREIT


def test_energy_configured():
    assert not cm.energy_configured({})
    assert cm.energy_configured({"energy": {"house_sensor": "sensor.haus"}})


def test_new_energy_keys_normalized():
    config = cm.normalize_config(
        {
            "energy": {
                "grid_import_sensor": "sensor.netzbezug",
                "grid_export_sensor": "sensor.einspeisung",
                "battery_power_sensor": "sensor.speicher_leistung",
                "battery_soc_sensor": "sensor.speicher_soc",
            }
        }
    )
    energy = config["energy"]
    assert energy["grid_import_sensor"] == "sensor.netzbezug"
    assert energy["grid_export_sensor"] == "sensor.einspeisung"
    assert energy["battery_power_sensor"] == "sensor.speicher_leistung"
    assert energy["battery_soc_sensor"] == "sensor.speicher_soc"
    assert energy["pv_sensor"] is None


def test_grid_mode_defaults_combined():
    config = cm.normalize_config({"energy": {"grid_sensor": "sensor.netz"}})
    assert config["energy"]["grid_mode"] == "combined"


def test_grid_mode_derived_separate_from_legacy_config():
    # Alte Installation mit getrennten Zählern (kein grid_mode-Feld):
    # die Anschluss-Variante wird automatisch abgeleitet und gespeichert.
    config = cm.normalize_config(
        {"energy": {"grid_import_sensor": "sensor.bezug", "grid_export_sensor": "sensor.export"}}
    )
    assert config["energy"]["grid_mode"] == "separate"
    # Und bleibt beim nächsten Durchlauf stabil erhalten
    again = cm.normalize_config(config)
    assert again["energy"]["grid_mode"] == "separate"


def test_grid_mode_separate_keeps_choice_with_combined_sensor():
    # Nutzer wählt „zwei getrennte“ – auch wenn ein kombinierter Sensor
    # (z. B. von früher) noch in der Konfiguration liegt.
    config = cm.normalize_config(
        {
            "energy": {
                "grid_sensor": "sensor.netz",
                "grid_mode": "separate",
                "grid_import_sensor": "sensor.bezug",
            }
        }
    )
    assert config["energy"]["grid_mode"] == "separate"
    assert config["energy"]["grid_sensor"] == "sensor.netz"  # wird nicht gelöscht


def test_grid_kind_inverted_is_valid():
    config = cm.normalize_config(
        {"energy": {"grid_sensor": "sensor.netz", "grid_kind": "inverted"}}
    )
    assert config["energy"]["grid_kind"] == "inverted"


def test_fahrzeug_defaults():
    device = cm.normalize_device(cm.default_device("fahrzeug", "Enyaq"))
    assert device["role"] == "fahrzeug"
    assert device["car"]["capacity_kwh"] == 60.0
    assert device["car"]["max_soc"] == 80.0
    assert device["wp"] is None
    assert device["control"]["type"] == CONTROL_SWITCH


def test_deadline_next_ts_today_and_tomorrow():
    tz = UTC
    now = datetime(2026, 3, 1, 12, 0, tzinfo=tz)
    # 18:00 heute -> heute
    ts = cm.deadline_next_ts(now, "18:00")
    assert ts == datetime(2026, 3, 1, 18, 0, tzinfo=tz).timestamp()
    # 08:00 -> morgen
    ts = cm.deadline_next_ts(now, "08:00")
    assert ts == datetime(2026, 3, 2, 8, 0, tzinfo=tz).timestamp()
    # ungültig -> None
    assert cm.deadline_next_ts(now, None) is None
    assert cm.deadline_next_ts(now, "kaputt") is None


def test_fahrzeug_home_wallbox_normalized():
    device = cm.default_device("fahrzeug", "Enyaq")
    device["car"]["home_wallbox"] = "wb1"
    normalized = cm.normalize_device(device)
    assert normalized["car"]["home_wallbox"] == "wb1"
    # Wallboxen tragen keine Heimat-Wallbox (gehört dem Auto)
    wallbox = cm.default_device("wallbox", "Garage")
    wallbox["car"]["home_wallbox"] = "wb1"
    assert cm.normalize_device(wallbox)["car"].get("home_wallbox") is None


def test_home_wallbox_must_reference_existing_wallbox():
    config = {
        "devices": [
            cm.default_device("wallbox", "Garage"),
            cm.default_device("fahrzeug", "Enyaq"),
        ],
        "settings": {},
    }
    config["devices"][0]["id"] = "wb1"
    car = config["devices"][1]
    car["id"] = "car1"
    car["car"]["home_wallbox"] = "unbekannt"
    normalized = cm.normalize_config(config)
    car_out = next(d for d in normalized["devices"] if d["id"] == "car1")
    assert car_out["car"]["home_wallbox"] is None


def test_settings_accent_and_intro_defaults():
    config = cm.normalize_config({"settings": {}})
    assert config["settings"]["accent"] == "auto"
    assert config["settings"]["accent_custom"] == ""
    assert config["settings"]["intro_done"] is False
    config = cm.normalize_config({"settings": {"accent": "gruen", "intro_done": True}})
    assert config["settings"]["accent"] == "gruen"
    assert config["settings"]["intro_done"] is True


def test_settings_custom_accent_color_validation():
    # Gültige freie Farbe wird übernommen
    config = cm.normalize_config(
        {"settings": {"accent": "custom", "accent_custom": "#ff9f1c"}}
    )
    assert config["settings"]["accent"] == "custom"
    assert config["settings"]["accent_custom"] == "#ff9f1c"
    # Ungültige Hex-Werte fallen zurück auf „Automatisch“ (ohne freie Farbe)
    for bad in ["#12345", "123456", "#gggggg", "#ff9f1"]:
        config = cm.normalize_config(
            {"settings": {"accent": "custom", "accent_custom": bad}}
        )
        assert config["settings"]["accent"] == "auto", bad
        assert config["settings"]["accent_custom"] == "", bad
