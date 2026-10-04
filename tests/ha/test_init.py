"""Setup, coordinator, sensor and service tests for PVM."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.pvm.const import DOMAIN

DASHBOARD = {
    "devices": {"total": 3, "totalPowerW": 4250},
    "forecast": {"totalResidualWh": 12000, "totalProductionWh": 34000},
}


@pytest.fixture(autouse=True)
def _mock_health(aioclient_mock):
    aioclient_mock.get(
        "http://pvm.local:7000/api/health", json={"status": "ok"}
    )


async def _setup(hass: HomeAssistant, entry: MockConfigEntry, aioclient_mock) -> None:
    aioclient_mock.get("http://pvm.local:7000/api/dashboard", json=DASHBOARD)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_setup_and_unload(hass: HomeAssistant, mock_entry, aioclient_mock) -> None:
    """A reachable backend loads sensors, services and the panel."""
    await _setup(hass, mock_entry, aioclient_mock)
    assert mock_entry.state is ConfigEntryState.LOADED
    assert mock_entry.entry_id in hass.data[DOMAIN]

    # Sensors from the dashboard payload.
    assert hass.states.get("sensor.pvm_total_power").state == "4250"
    assert hass.states.get("sensor.pvm_device_count").state == "3"
    assert hass.states.get("sensor.pvm_residual_energy").state == "12.0"
    # Services registered.
    for service in ("set_device_power", "run_planning_cycle", "get_devices"):
        assert hass.services.has_service(DOMAIN, service)

    # Panel registered.
    assert "pvm" in hass.data.get("frontend_panels", {})

    assert await hass.config_entries.async_unload(mock_entry.entry_id)
    await hass.async_block_till_done()
    assert mock_entry.state is ConfigEntryState.NOT_LOADED
    assert "pvm" not in hass.data.get("frontend_panels", {})


async def test_coordinator_auth_failure_triggers_reauth(
    hass: HomeAssistant, mock_entry, aioclient_mock
) -> None:
    """HTTP 401 from the backend starts a reauth flow."""
    aioclient_mock.get("http://pvm.local:7000/api/dashboard", status=401, json={})
    mock_entry.add_to_hass(hass)
    with patch(
        "custom_components.pvm.config_flow._validate", return_value=None
    ), patch.object(hass.config_entries, "async_reload", return_value=None):
        await hass.config_entries.async_setup(mock_entry.entry_id)
    await hass.async_block_till_done()
    # The failed refresh forces the entry into SETUP_ERROR / reauth.
    assert hass.config_entries.flow.async_progress()
