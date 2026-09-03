"""Tests für das Entitäten-Mapping der eigenen Panel-Seite."""


from custom_components.pvm.config_model import default_device, normalize_config
from custom_components.pvm.panel_data import build_entity_map, build_panel_payload


class FakeRegistry:
    """Minimal-Stub der Entity-Registry (async_get_entity_id)."""

    def __init__(self, mapping: dict[str, str]) -> None:
        self._mapping = mapping

    def async_get_entity_id(self, platform: str, domain: str, unique_id: str):
        # Nur PVM-Entitäten sind registriert
        if domain != "pvm":
            return None
        return self._mapping.get(unique_id)


class FakeManager:
    """Stub eines Managers (Konfiguration + Setup-Stufe)."""

    def __init__(self, config: dict, scan: dict | None = None, hass=None) -> None:
        self.config = normalize_config(config)
        self.last_scan = scan or {}
        self.hass = hass or object()

    def setup_stage(self):
        from custom_components.pvm.config_model import setup_stage

        return setup_stage(self.config)


def _registry_for(device_id: str) -> FakeRegistry:
    """Erzeugt eine Registry mit den Entitäten eines Wallbox-Geräts."""
    return FakeRegistry(
        {
            "pvm_surplus": "sensor.pvm_ueberschuss",
            "pvm_status": "sensor.pvm_status",
            "pvm_mode": "select.pvm_modus",
            f"pvm_auto_{device_id}": f"switch.wallbox_auto_{device_id}",
            f"pvm_status_{device_id}": f"sensor.wallbox_status_{device_id}",
            f"pvm_rank_{device_id}": f"sensor.wallbox_rank_{device_id}",
            f"pvm_min_soc_{device_id}": f"number.wallbox_min_soc_{device_id}",
            f"pvm_power_charge_{device_id}": f"switch.wallbox_power_{device_id}",
        }
    )


def test_build_entity_map_with_wallbox():
    device = default_device("wallbox", "Wallbox")
    config = {"energy": {}, "settings": {}, "devices": [device]}
    registry = _registry_for(device["id"])

    entities = build_entity_map(registry, config)

    assert entities["surplus"] == "sensor.pvm_ueberschuss"
    assert entities["mode"] == "select.pvm_modus"
    dev = entities["devices"][device["id"]]
    assert dev["auto"] == f"switch.wallbox_auto_{device['id']}"
    assert dev["min_soc"] == f"number.wallbox_min_soc_{device['id']}"
    # Wallbox ohne WP-Kinds
    assert dev.get("comfort") is None
    assert dev.get("test_start") is None
    # Verbraucher-spezifisches „nominal“ fehlt bei Wallbox
    assert dev.get("nominal") is None


def test_build_entity_map_wp_roles():
    device = default_device("waermepumpe", "Wärmepumpe")
    config = {"devices": [device]}
    registry = _registry_for("wp1")

    entities = build_entity_map(registry, config)
    dev = entities["devices"][device["id"]]
    # WP hat keine Wallbox-Kinds
    assert dev.get("min_soc") is None
    assert dev.get("power_charge") is None


def test_payload_contains_config_scan_and_version():
    device = default_device("wallbox", "Wallbox")
    config = {
        "energy": {"pv_sensor": "sensor.pv"},
        "settings": {},
        "devices": [device],
    }
    manager = FakeManager(config, scan={"sets": [{"role": "pv", "title": "PV"}]})
    payload = build_panel_payload(manager, registry=_registry_for(device["id"]))

    assert payload["config"]["devices"][0]["name"] == "Wallbox"
    assert payload["entities"]["surplus"]
    assert payload["scan"]["sets"][0]["role"] == "pv"
    assert payload["version"]
    assert payload["setup"] == "bereit"
