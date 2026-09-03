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


def test_match_power_soc_correlation_negative():
    # Leistung hoch, aber SoC steigt nicht
    power = [(0.0, 3000.0), (60.0, 3200.0), (120.0, 3100.0)]
    soc = [(0.0, 50.0), (60.0, 50.2), (120.0, 50.1)]
    assert detector.match_power_soc(power, soc) is False
