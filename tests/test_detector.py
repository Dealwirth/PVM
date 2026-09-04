"""Tests für die Geräte-Erkennung."""

from custom_components.pvm import detector


def ent(entity_id, name="", device_class="", unit=""):
    return {
        "entity_id": entity_id,
        "name": name,
        "device_class": device_class,
        "unit_of_measurement": unit,
    }


def test_detects_pv_by_keyword():
    entities = [
        ent("sensor.pv_leistung", "PV Leistung", "power", "W"),
        ent("sensor.other", "Temperatur", "temperature", "°C"),
    ]
    result = detector.suggest_energy(entities)
    assert result["pv"] == "sensor.pv_leistung"


def test_detects_grid_and_house():
    entities = [
        ent("sensor.netzbezug", "Netzbezug", "power", "W"),
        ent("sensor.hausverbrauch", "Hausverbrauch", "power", "W"),
    ]
    result = detector.suggest_energy(entities)
    assert result["grid"] == "sensor.netzbezug"
    assert result["house"] == "sensor.hausverbrauch"


def test_detects_wallbox_and_soc():
    entities = [
        ent("sensor.wallbox_leistung", "Wallbox Leistung", "power", "W"),
        ent("sensor.auto_soc", "Auto SoC", "battery", "%"),
        ent("sensor.wallbox_soc", "Wallbox SoC", "", "%"),
    ]
    result = detector.suggest_devices(entities)
    assert "sensor.wallbox_leistung" in result["wallbox"]
    assert "sensor.auto_soc" in result["auto_soc"]
    # "wallbox soc" enthält wallbox UND soc – muss als SoC erkannt werden
    assert "sensor.wallbox_soc" in result["auto_soc"]


def test_wallbox_battery_charging_device_class():
    entities = [
        ent("sensor.charger_power", "Charger", "battery_charging", "W"),
    ]
    result = detector.suggest_devices(entities)
    assert "sensor.charger_power" in result["wallbox"]


def test_detects_heat_pump_temperature():
    entities = [
        ent("sensor.waermepumpe_temperatur", "Wärmepumpe Temperatur", "temperature", "°C"),
    ]
    result = detector.suggest_devices(entities)
    assert "sensor.waermepumpe_temperatur" in result["wp_temp"]


def test_ignores_unrelated_sensors():
    entities = [
        ent("sensor.kuehlschrank", "Kühlschrank", "temperature", "°C"),
        ent("sensor.tuer", "Tür", "door", ""),
        ent("binary_sensor.bewegung", "Bewegung", "motion", ""),
    ]
    assert detector.suggest_devices(entities)["wallbox"] == []
    assert detector.suggest_devices(entities)["wp_temp"] == []


def test_match_power_soc_correlation_positive():
    power = [(0.0, 0.0), (30.0, 3000.0), (60.0, 3200.0), (90.0, 3100.0)]
    soc = [(0.0, 50.0), (30.0, 51.0), (60.0, 53.0), (90.0, 55.0)]
    assert detector.match_power_soc(power, soc) is True


def test_manufacturer_signals_help():
    # Ohne „wallbox“ im Namen, aber mit Hersteller-Signal
    entities = [
        ent("sensor.garage_charge_power", "Ladeleistung", "power", "W"),
    ]
    enriched = [{**entities[0], "manufacturer": "go-e", "model": "Charger Home+"}]
    assert "sensor.garage_charge_power" in detector.suggest_devices(enriched)["wallbox"]


def test_ev_model_detected_as_soc():
    entities = [
        ent("sensor.enyaq_battery", "Batterie", "battery", "%"),
    ]
    result = detector.suggest_devices(entities)
    assert "sensor.enyaq_battery" in result["auto_soc"]


def test_multi_candidates_ranked_with_reasons():
    entities = [
        ent("sensor.wechselrichter_leistung", "PV Leistung", "power", "W"),
        ent("sensor.solar_leistung", "Solar Leistung", "power", "W"),
        ent("sensor.haus_leistung", "Haus Leistung", "power", "W"),
    ]
    candidates = detector.candidates_for_role(entities, "pv", top_n=2)
    assert len(candidates) == 2
    assert all(c["entity_id"] for c in candidates)
    assert all(c["reasons"] for c in candidates)
    # Beste zuerst
    assert candidates[0]["score"] >= candidates[1]["score"]


def test_suggest_sets_groups_device_with_buttons():
    entities = [
        ent("sensor.wallbox_leistung", "Wallbox Ladeleistung", "power", "W"),
        ent("switch.wallbox_freigabe", "Wallbox Freigabe", "", ""),
        ent("button.wallbox_start", "Wallbox Laden starten", "", ""),
        ent("button.wallbox_stop", "Wallbox Laden stoppen", "", ""),
        ent("sensor.auto_soc", "Auto SoC", "battery", "%"),
    ]
    with_device = [
        {**e, "device_id": "dev_wallbox", "device_name": "Wallbox Garage",
         "manufacturer": "openWB", "model": "Pro"}
        for e in entities
    ]
    sets = detector.suggest_sets(with_device)
    wallbox_sets = [s for s in sets if s["role"] == "wallbox"]
    assert wallbox_sets
    found = wallbox_sets[0]
    assert found["title"] == "Wallbox Garage"
    assert found["fields"]["power_sensor"] == "sensor.wallbox_leistung"
    assert found["fields"]["on_entity"] == "button.wallbox_start"
    assert found["fields"]["off_entity"] == "button.wallbox_stop"
    assert found["fields"]["soc_sensor"] == "sensor.auto_soc"


def test_match_power_soc_correlation_negative():
    # Leistung hoch, aber SoC steigt nicht
    power = [(0.0, 3000.0), (60.0, 3200.0), (120.0, 3100.0)]
    soc = [(0.0, 50.0), (60.0, 50.2), (120.0, 50.1)]
    assert detector.match_power_soc(power, soc) is False


# ---------------------------------------------------------------------------
# Auto → Wallbox-Zuordnung (über die Ladeleistungen)
# ---------------------------------------------------------------------------

def test_assign_single_car_single_wallbox():
    cars = [{"id": "car1", "power_w": 3200.0}]
    wallboxes = [{"id": "wb1", "power_w": 3200.0}]
    assert detector.assign_cars_to_wallboxes(cars, wallboxes) == {"car1": "wb1"}


def test_assign_matches_closest_power():
    cars = [
        {"id": "car1", "power_w": 7000.0},
        {"id": "car2", "power_w": 3000.0},
    ]
    wallboxes = [
        {"id": "wb1", "power_w": 6900.0},
        {"id": "wb2", "power_w": 3100.0},
    ]
    result = detector.assign_cars_to_wallboxes(cars, wallboxes)
    assert result == {"car1": "wb1", "car2": "wb2"}


def test_assign_only_charging_devices_count():
    cars = [
        {"id": "car1", "power_w": 5000.0},
        {"id": "car2", "power_w": 0.0},   # unterwegs
    ]
    wallboxes = [
        {"id": "wb1", "power_w": 5000.0},
        {"id": "wb2", "power_w": 20.0},   # nicht am Laden
    ]
    result = detector.assign_cars_to_wallboxes(cars, wallboxes)
    assert result == {"car1": "wb1"}
    assert "car2" not in result


def test_assign_unknown_power_is_ignored():
    cars = [{"id": "car1", "power_w": None}]
    wallboxes = [{"id": "wb1", "power_w": 4000.0}]
    assert detector.assign_cars_to_wallboxes(cars, wallboxes) == {}


def test_assign_too_far_apart_stays_unassigned():
    cars = [{"id": "car1", "power_w": 11000.0}]
    wallboxes = [{"id": "wb1", "power_w": 1000.0}]
    assert detector.assign_cars_to_wallboxes(cars, wallboxes) == {}


def test_suggest_sets_detects_car():
    entities = [
        ent("sensor.enyaq_battery", "Batterie", "battery", "%"),
        ent("sensor.enyaq_charging_power", "Ladeleistung", "power", "W"),
    ]
    with_device = [
        {**e, "device_id": "dev_car", "device_name": "Enyaq",
         "manufacturer": "Skoda", "model": "Enyaq 85"}
        for e in entities
    ]
    sets = detector.suggest_sets(with_device)
    car_sets = [s for s in sets if s["role"] == "fahrzeug"]
    assert car_sets
    found = car_sets[0]
    assert found["fields"]["soc_sensor"] == "sensor.enyaq_battery"
    assert found["fields"]["power_sensor"] == "sensor.enyaq_charging_power"
