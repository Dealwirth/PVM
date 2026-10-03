"""Service and proxy-view tests for PVM."""

from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant

from custom_components.pvm.const import DOMAIN

DASHBOARD = {"devices": {"total": 1, "totalPowerW": 100}, "forecast": None}


@pytest.fixture(autouse=True)
def _mock_backend(aioclient_mock):
    aioclient_mock.get("http://pvm.local:7000/api/health", json={"status": "ok"})


async def _setup(hass: HomeAssistant, entry, aioclient_mock) -> None:
    aioclient_mock.get("http://pvm.local:7000/api/dashboard", json=DASHBOARD)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_service_call_forwarded(hass, mock_entry, aioclient_mock) -> None:
    """A pvm.* service is POSTed to the backend with a filtered payload."""
    await _setup(hass, mock_entry, aioclient_mock)
    aioclient_mock.post(
        "http://pvm.local:7000/api/ha/services/set_device_power",
        json={"ok": True},
    )

    await hass.services.async_call(
        DOMAIN,
        "set_device_power",
        {"device_id": "wallbox-1", "power": 11000},
        blocking=True,
    )

    calls = [c for c in aioclient_mock.mock_calls if c[0] == "POST"]
    assert len(calls) == 1
    _method, url, _data, headers = calls[0]
    assert url.path.endswith("/api/ha/services/set_device_power")
    assert headers["Authorization"] == "Bearer secret-token"


async def test_proxy_forwards_get(hass, mock_entry, aioclient_mock, hass_client) -> None:
    """The authenticated proxy forwards to the backend and returns JSON."""
    await _setup(hass, mock_entry, aioclient_mock)
    client = await hass_client()
    resp = await client.get("/api/pvm/dashboard")
    assert resp.status == 200
    assert await resp.json() == DASHBOARD


async def test_proxy_requires_auth(hass, mock_entry, aioclient_mock, hass_client_no_auth) -> None:
    """Unauthenticated requests to the proxy are rejected."""
    await _setup(hass, mock_entry, aioclient_mock)
    client = await hass_client_no_auth()
    resp = await client.get("/api/pvm/dashboard")
    assert resp.status == 401


async def test_update_plan_forwards_plan_payload(hass, mock_entry, aioclient_mock) -> None:
    """The plan object survives the allowed-keys filter and reaches the backend."""
    await _setup(hass, mock_entry, aioclient_mock)
    aioclient_mock.post(
        "http://pvm.local:7000/api/ha/services/update_plan",
        json=[{"id": "plan-1"}],
    )
    plan = {"id": "plan-1", "slots": [], "conditions": [], "shutdowns": [], "inputHash": "x"}

    await hass.services.async_call(
        DOMAIN, "update_plan", {"plan": plan}, blocking=True
    )

    posts = [c for c in aioclient_mock.mock_calls if c[0] == "POST"]
    assert posts, "expected a POST to the backend"
    _method, url, data, _headers = posts[-1]
    assert url.path.endswith("/api/ha/services/update_plan")
    assert data is not None
    assert data["plan"] == plan


async def test_all_services_registered(hass, mock_entry, aioclient_mock) -> None:
    """Every service declared in const.SERVICES is registered."""
    await _setup(hass, mock_entry, aioclient_mock)
    from custom_components.pvm.const import SERVICES

    for service in SERVICES:
        assert hass.services.has_service(DOMAIN, service), service
