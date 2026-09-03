"""Tests für das Konfigurations-Modell."""

from datetime import UTC, datetime

from custom_components.pvm import config_model as cm
from custom_components.pvm.const import (
    DEFAULT_CONFIG,
    ROLE_VERBRAUCHER,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
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
