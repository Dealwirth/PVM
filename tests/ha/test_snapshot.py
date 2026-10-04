"""Tests for the API-free snapshot push to the PVM backend."""

from __future__ import annotations

from homeassistant.core import HomeAssistant

from custom_components.pvm.coordinator import _jsonable

DASHBOARD = {"devices": {"total": 0, "totalPowerW": 0}, "forecast": None}


def _ingest_calls(aioclient_mock) -> list:
    return [
        call
        for call in aioclient_mock.mock_calls
        if call[0] == "POST" and call[1].path.endswith("/api/ha/internal/ingest")
    ]


async def test_snapshot_pushed_on_poll(
    hass: HomeAssistant, mock_entry, aioclient_mock
) -> None:
    """The coordinator pushes HA states, services and registries to PVM."""
    aioclient_mock.get("http://pvm.local:7000/api/health", json={"status": "ok"})
    aioclient_mock.get("http://pvm.local:7000/api/dashboard", json=DASHBOARD)
    aioclient_mock.post("http://pvm.local:7000/api/ha/internal/detect", json={"ok": True})
    aioclient_mock.post("http://pvm.local:7000/api/ha/internal/ingest", json={"ok": True})

    hass.states.async_set("sensor.pv_power", "1234", {"unit_of_measurement": "W"})

    mock_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(mock_entry.entry_id)
    await hass.async_block_till_done()

    ingests = _ingest_calls(aioclient_mock)
    assert ingests, "expected a snapshot POST to the ingest endpoint"

    _method, _url, payload, headers = ingests[0]
    assert headers["Authorization"] == "Bearer secret-token"
    assert any(s["entity_id"] == "sensor.pv_power" for s in payload["states"])
    assert "haVersion" in payload
    assert "deviceRegistry" in payload
    assert "entityRegistry" in payload


def test_jsonable_handles_sets_tuples_and_datetimes() -> None:
    """Registry values contain sets/tuples/datetimes that json cannot encode."""
    from datetime import datetime, timezone

    value = {
        "identifiers": {("pvm", "abc")},
        "labels": frozenset({"a", "b"}),
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "nested": [{"ids": {"x"}}],
    }
    result = _jsonable(value)
    assert isinstance(result["identifiers"], list)
    assert isinstance(result["labels"], list)
    assert result["created_at"] == "2026-01-01T00:00:00+00:00"
    assert isinstance(result["nested"][0]["ids"], list)
    # Must be JSON-serialisable end to end.
    import json

    json.dumps(result)
