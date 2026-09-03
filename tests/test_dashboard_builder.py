"""Tests für den Dashboard-Builder."""

import custom_components.pvm.dashboard_builder as db
from custom_components.pvm.const import ROLE_WAERMEPUMPE, ROLE_WALLBOX, UI_THEME_COOL


def make_model(**overrides):
    model = db.DashboardModel(
        global_entities={
            "surplus": "sensor.pvm_ueberschuss",
            "setup": "sensor.pvm_setup",
            "mode": "select.pvm_modus",
            "theme": "select.pvm_theme",
            "engine_status": "sensor.pvm_status",
            "group_global": "switch.pvm_group_global",
            "scan": "button.pvm_scan",
            "rebuild": "button.pvm_rebuild",
            "cycle": "number.pvm_cycle",
            "min_on": "number.pvm_min_on",
            "min_off": "number.pvm_min_off",
        },
        energy={"pv": "sensor.pv_leistung", "grid": "sensor.netzbezug"},
        devices=[
            db.DeviceView(
                id="auto1",
                name="Auto 1",
                role=ROLE_WALLBOX,
                priority=1,
                entities={
                    "rank": "sensor.auto1_rank",
                    "up": "button.auto1_up",
                    "down": "button.auto1_down",
                    "auto": "switch.auto1_auto",
                    "power_charge": "switch.auto1_power_charge",
                    "options": "switch.auto1_options",
                    "status": "sensor.auto1_status",
                    "min_soc": "number.auto1_min_soc",
                    "max_soc": "number.auto1_max_soc",
                    "deadline_soc": "number.auto1_deadline_soc",
                    "deadline_time": "time.auto1_deadline_time",
                    "power_limit": "number.auto1_power_limit",
                    "min_on_power": "number.auto1_min_on_power",
                },
                source={"soc": "sensor.auto1_soc", "power": "sensor.auto1_power"},
            ),
            db.DeviceView(
                id="wp1",
                name="Wärmepumpe",
                role=ROLE_WAERMEPUMPE,
                priority=2,
                entities={
                    "rank": "sensor.wp1_rank",
                    "up": "button.wp1_up",
                    "down": "button.wp1_down",
                    "auto": "switch.wp1_auto",
                    "options": "switch.wp1_options",
                    "status": "sensor.wp1_status",
                    "test_start": "button.wp1_test_start",
                    "test_abort": "button.wp1_test_abort",
                    "comfort": "number.wp1_comfort",
                },
                source={"temp": "sensor.wp1_temp"},
            ),
        ],
    )
    return db.DashboardModel(**{**model.__dict__, **overrides})


def _view(config, part: str) -> dict:
    for view in config["views"]:
        if part in view["title"]:
            return view
    raise AssertionError(f"Ansicht mit {part!r} nicht gefunden")


def test_build_returns_title_and_five_views():
    config = db.build_dashboard_config(make_model())
    assert config["title"] == "PV Manager"
    assert len(config["views"]) == 5
    titles = [view["title"] for view in config["views"]]
    for part in ("Start", "Übersicht", "Geräte", "Reihenfolge", "Einstellungen"):
        assert any(part in title for title in titles)


def test_start_contains_welcome_and_tutorial():
    config = db.build_dashboard_config(make_model())
    start = _view(config, "Start")
    all_text = " ".join(
        str(card.get("content", ""))
        for card in start["cards"]
        if card.get("type") == "markdown"
    )
    assert "So geht's" in all_text
    # Willkommens-Karte ist vorhanden, aber an den Setup-Status gekoppelt
    assert any(card.get("type") == "conditional" for card in start["cards"])
    assert "Willkommen bei PV Manager" in str(config)


def test_overview_contains_energy_tiles_and_history():
    config = db.build_dashboard_config(make_model())
    overview = _view(config, "Übersicht")
    cards = overview["cards"]
    assert any(card.get("type") == "history-graph" for card in cards)
    assert any(card.get("type") == "grid" for card in cards)


def test_overview_without_energy_shows_hint():
    model = make_model(energy={}, global_entities={})
    config = db.build_dashboard_config(model)
    overview = _view(config, "Übersicht")
    text = " ".join(
        str(card.get("content", ""))
        for card in overview["cards"]
        if card.get("type") == "markdown"
    )
    assert "Noch keine Messungen" in text


def test_devices_ordered_by_priority():
    config = db.build_dashboard_config(make_model())
    devices_view = _view(config, "Geräte")
    first_heading = next(
        card["content"]
        for card in devices_view["cards"]
        if card.get("type") == "markdown" and card.get("content", "").startswith("### ")
    )
    assert first_heading == "### Auto 1"


def test_empty_devices_yields_hint_with_link():
    model = db.DashboardModel(global_entities={}, energy={})
    config = db.build_dashboard_config(model)
    geräte = _view(config, "Geräte")
    text = " ".join(
        str(card.get("content", ""))
        for card in geräte["cards"]
        if card.get("type") == "markdown"
    )
    assert "Noch keine Geräte" in text


def test_settings_uses_conditional_group_cards():
    config = db.build_dashboard_config(make_model())
    settings = _view(config, "Einstellungen")
    conditionals = [
        card for card in settings["cards"] if card.get("type") == "conditional"
    ]
    assert conditionals, "Erwartete aufklappbare Gruppen (conditional-Karten)"
    # Globale Gruppe enthält Regler (cycle) …
    text = str(conditionals[0])
    assert "number.pvm_cycle" in text
    # … und Geräte-Gruppen enthalten Wallbox-Feintuning
    all_text = " ".join(str(c) for c in conditionals)
    assert "number.auto1_power_limit" in all_text
    assert "switch.auto1_options" in text or "switch.wp1_options" in all_text


def test_theme_changes_icons():
    sunrise = db.build_dashboard_config(make_model())
    cool = db.build_dashboard_config(make_model(theme=UI_THEME_COOL))
    start_sunrise = _view(sunrise, "Start")
    start_cool = _view(cool, "Start")
    assert start_sunrise["icon"] != start_cool["icon"]


def test_suggestions_rendered_in_devices_view():
    model = make_model(suggestions=[{"role": "wallbox", "title": "Garage"}])
    config = db.build_dashboard_config(model)
    devices_view = _view(config, "Geräte")
    text = " ".join(
        str(card.get("content", ""))
        for card in devices_view["cards"]
        if card.get("type") == "markdown"
    )
    assert "Garage" in text
