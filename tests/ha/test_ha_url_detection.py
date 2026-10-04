"""Tests for pushing the HA base URL to the PVM backend (setup assistant)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from homeassistant.core import HomeAssistant

from custom_components.pvm.const import DOMAIN
from custom_components.pvm.coordinator import _ha_url_candidates

DASHBOARD = {"devices": {"total": 0, "totalPowerW": 0}, "forecast": None}


def _fake_hass(internal: str | None, external: str | None, base: str | None) -> SimpleNamespace:
    api = SimpleNamespace(base_url=base)
    config = SimpleNamespace(internal_url=internal, external_url=external, api=api)
    return SimpleNamespace(config=config)


def test_candidates_prefer_internal_and_deduplicate() -> None:
    """internal_url comes first, duplicates are removed, trailing slashes trimmed."""
    hass = _fake_hass(
        internal="http://homeassistant.local:8123/",
        external="https://ha.example.com",
        base="http://homeassistant.local:8123",
    )
    assert _ha_url_candidates(hass) == [
        "http://homeassistant.local:8123",
        "https://ha.example.com",
    ]


def test_candidates_empty_when_unset() -> None:
    assert _ha_url_candidates(_fake_hass(None, None, None)) == []


async def test_push_ha_url_posts_candidates(
    hass: HomeAssistant, mock_entry, aioclient_mock
) -> None:
    """The coordinator POSTs the derived candidates to the PVM detect endpoint."""
    aioclient_mock.get("http://pvm.local:7000/api/health", json={"status": "ok"})
    aioclient_mock.get("http://pvm.local:7000/api/dashboard", json=DASHBOARD)
    aioclient_mock.post(
        "http://pvm.local:7000/api/ha/internal/detect",
        json={"ok": True, "url": "http://homeassistant.local:8123"},
    )
    with patch(
        "custom_components.pvm.coordinator._ha_url_candidates",
        return_value=["http://homeassistant.local:8123"],
    ):
        mock_entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(mock_entry.entry_id)
        await hass.async_block_till_done()

    posts = [c for c in aioclient_mock.mock_calls if c[0] == "POST"]
    detect = [c for c in posts if c[1].path.endswith("/api/ha/internal/detect")]
    assert detect, "expected a POST to the detect endpoint"
    _method, _url, data, headers = detect[0]
    assert data == {"candidates": ["http://homeassistant.local:8123"]}
    assert headers["Authorization"] == "Bearer secret-token"


async def test_detect_service_triggers_push(
    hass: HomeAssistant, mock_entry, aioclient_mock
) -> None:
    """Calling pvm.detect_ha_url re-pushes the candidates."""
    aioclient_mock.get("http://pvm.local:7000/api/health", json={"status": "ok"})
    aioclient_mock.get("http://pvm.local:7000/api/dashboard", json=DASHBOARD)
    aioclient_mock.post("http://pvm.local:7000/api/ha/internal/detect", json={"ok": True})

    def detect_calls() -> list:
        return [
            c
            for c in aioclient_mock.mock_calls
            if c[0] == "POST" and c[1].path.endswith("/api/ha/internal/detect")
        ]

    with patch(
        "custom_components.pvm.coordinator._ha_url_candidates",
        return_value=["http://homeassistant.local:8123"],
    ):
        mock_entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(mock_entry.entry_id)
        await hass.async_block_till_done()
        after_setup = len(detect_calls())

        await hass.services.async_call(DOMAIN, "detect_ha_url", {}, blocking=True)
        await hass.async_block_till_done()

    assert len(detect_calls()) > after_setup, "expected the service to trigger a detect POST"
