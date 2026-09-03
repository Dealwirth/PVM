"""Tests für den Dashboard-Builder."""

from custom_components.pvm import dashboard_builder as db
from custom_components.pvm.const import ROLE_WAERMEPUMPE, ROLE_WALLBOX


def make_model():
    return db.DashboardModel(
        global_entities={
            "surplus": "sensor.pvm_ueberschuss",
            "mode": "select.pvm_modus",
            "engine_status": "sensor.pvm_status",
            "scan": "button.pvm_scan",
            "rebuild": "button.pvm_rebuild",
        },
        energy={
            "pv": "sensor.pv_leistung",
            "grid": "sensor.netzbezug",
        },
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
                    "status": "sensor.auto1_status",
                    "min_soc": "number.auto1_min_soc",
                    "max_soc": "number.auto1_max_soc",
                    "deadline_soc": "number.auto1_deadline_soc",
                    "deadline_time": "time.auto1_deadline_time",
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
                    "status": "sensor.wp1_status",
                    "test_start": "button.wp1_test_start",
                    "test_abort": "button.wp1_test_abort",
                    "comfort": "number.wp1_comfort",
                },
                source={"temp": "sensor.wp1_temp"},
            ),
        ],
    )


def test_build_returns_title_and_views():
    config = db.build_dashboard_config(make_model())
    assert config["title"] == "PV Manager"
    assert len(config["views"]) == 4
    titles = [view["title"] for view in config["views"]]
    assert titles == ["Übersicht", "Prioritäten", "Geräte", "Einstellungen"]


def test_overview_contains_energy_tiles_and_history():
    config = db.build_dashboard_config(make_model())
    overview = config["views"][0]
    cards = overview["cards"]
    assert any(
        "type" in card and card.get("type") == "history-graph" for card in cards
    )


def test_devices_ordered_by_priority():
    config = db.build_dashboard_config(make_model())
    devices_view = config["views"][2]
    # Erste Geräte-Überschrift ist das Auto (Priorität 1)
    first_heading = None
    for card in devices_view["cards"]:
        if card.get("type") == "markdown" and card.get("content", "").startswith("### "):
            first_heading = card["content"]
            break
    assert first_heading == "### Auto 1"


def test_empty_devices_yields_hint():
    model = db.DashboardModel(global_entities={}, energy={})
    config = db.build_dashboard_config(model)
    geräte = next(v for v in config["views"] if v["title"] == "Geräte")
    assert any("Noch keine Geräte" in c.get("content", "") for c in geräte["cards"])
