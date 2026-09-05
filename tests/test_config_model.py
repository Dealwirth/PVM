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
    # Notfall-Minimum beginnt bei 60 °C (Legionellen-Schutz) – nie tiefer.
    device = cm.normalize_device(cm.default_device(ROLE_WAERMEPUMPE, "WP"))
    assert device["wp"]["comfort_c"] == 60.0
    assert device["wp"]["safety_min_c"] == 60.0


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


def test_has_limiter_flag_normalized():
    device = cm.default_device(ROLE_WALLBOX, "Wallbox")
    device["control"]["has_limiter"] = True
    device["control"]["number_entity"] = "number.wallbox_max"
    normalized = cm.normalize_device(device)
    assert normalized["control"]["type"] == CONTROL_SWITCH
    assert normalized["control"]["has_limiter"] is True
    assert normalized["control"]["number_entity"] == "number.wallbox_max"


def test_legacy_switch_number_migrates_to_has_limiter():
    device = cm.default_device(ROLE_WALLBOX, "Wallbox")
    device["control"] = {
        "type": "switch_number",
        "switch_entity": "switch.freigabe",
        "number_entity": "number.max",
        "number_unit": "A",
        "phases": 3,
    }
    normalized = cm.normalize_device(device)
    assert normalized["control"]["type"] == CONTROL_SWITCH
    assert normalized["control"]["has_limiter"] is True
    assert normalized["control"]["number_entity"] == "number.max"


def test_limiter_without_entity_downgraded():
    device = cm.default_device(ROLE_WALLBOX, "Wallbox")
    device["control"]["has_limiter"] = True  # aber keine number_entity
    normalized = cm.normalize_device(device)
    assert normalized["control"]["has_limiter"] is False


def test_wp_temp_requires_temp_entity():
    device = cm.default_device(ROLE_WAERMEPUMPE, "WP")
    device["control"]["type"] = "wp_temp"
    device["control"]["temp_entity"] = "number.wp_soll"
    normalized = cm.normalize_device(device)
    assert normalized["control"]["type"] == "wp_temp"
    assert normalized["control"]["temp_entity"] == "number.wp_soll"

    # Ohne temp_entity -> auf einfachen Schalter zurückfallen
    broken = cm.default_device(ROLE_WAERMEPUMPE, "WP")
    broken["control"]["type"] = "wp_temp"
    normalized_broken = cm.normalize_device(broken)
    assert normalized_broken["control"]["type"] == CONTROL_SWITCH


def test_wp_boost_c_default_and_clamp():
    device = cm.default_device(ROLE_WAERMEPUMPE, "WP")
    normalized = cm.normalize_device(device)
    wp = normalized["wp"]
    assert wp["boost_c"] is not None
    assert wp["boost_c"] > wp["comfort_c"]
    assert 40.0 <= wp["boost_c"] <= 80.0


def test_settings_auto_pairing_and_manual_defaults():
    config = cm.normalize_config(None)
    assert config["settings"]["auto_pairing"] is False
    assert config["settings"]["manual_mode"] is False
    on = cm.normalize_config({"settings": {"auto_pairing": True, "manual_mode": True}})
    assert on["settings"]["auto_pairing"] is True
    assert on["settings"]["manual_mode"] is True


def test_forecast_settings_default_off_and_api_key():
    # Prognose ist standardmäßig AUS (erscheint erst nach Einschalten);
    # der optionale API-Schlüssel wird als Text übernommen und gestrippt.
    config = cm.normalize_config(None)
    assert config["settings"]["forecast_enabled"] is False
    assert config["settings"]["forecast_api_key"] == ""
    cfg = cm.normalize_config(
        {"settings": {"forecast_enabled": True, "forecast_api_key": "  abc123  "}}
    )
    assert cfg["settings"]["forecast_enabled"] is True
    assert cfg["settings"]["forecast_api_key"] == "abc123"


def test_forecast_location_settings_default_and_override():
    # Standort-Frage bei der Einrichtung: Standard aus, Koordinaten leer.
    config = cm.normalize_config(None)
    assert config["settings"]["pv_at_hass_location"] is False
    assert config["settings"]["forecast_lat"] == ""
    assert config["settings"]["forecast_lon"] == ""
    # Bestätigt + gültige Koordinaten-Überschreibung
    cfg = cm.normalize_config(
        {"settings": {
            "pv_at_hass_location": True,
            "forecast_lat": " 48.1374 ",
            "forecast_lon": "11.5755",
        }}
    )
    assert cfg["settings"]["pv_at_hass_location"] is True
    assert cfg["settings"]["forecast_lat"] == "48.1374"
    assert cfg["settings"]["forecast_lon"] == "11.5755"
    # Ungültige Einträge werden verworfen (kein Crash)
    bad = cm.normalize_config({"settings": {"forecast_lat": "keine-zahl"}})
    assert bad["settings"]["forecast_lat"] == ""
