"""Config flow tests for the PVM custom component."""

from __future__ import annotations

from unittest.mock import patch

from homeassistant import config_entries, data_entry_flow
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.pvm.const import (
    CONF_PVM_TOKEN,
    CONF_PVM_URL,
    CONF_SCAN_INTERVAL,
    DOMAIN,
)


async def test_user_flow_success(hass: HomeAssistant, pvm_url: str) -> None:
    """A reachable backend creates the entry and normalises the URL."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == data_entry_flow.FlowResultType.FORM
    assert result["step_id"] == "user"

    with patch("custom_components.pvm.config_flow._validate", return_value=None):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_PVM_URL: f"{pvm_url}/",
                CONF_PVM_TOKEN: "secret",
                CONF_SCAN_INTERVAL: 15,
            },
        )

    assert result["type"] == data_entry_flow.FlowResultType.CREATE_ENTRY
    assert result["data"][CONF_PVM_URL] == pvm_url  # trailing slash stripped
    assert result["data"][CONF_PVM_TOKEN] == "secret"


async def test_user_flow_cannot_connect(hass: HomeAssistant, pvm_url: str) -> None:
    """A failing health check surfaces the cannot_connect form error."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    with patch(
        "custom_components.pvm.config_flow._validate",
        side_effect=ConnectionError("boom"),
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {CONF_PVM_URL: pvm_url, CONF_PVM_TOKEN: "x"}
        )

    assert result["type"] == data_entry_flow.FlowResultType.FORM
    assert result["errors"]["base"] == "cannot_connect"


async def test_user_flow_duplicate_aborts(hass: HomeAssistant, pvm_url: str) -> None:
    """A second entry for the same URL is rejected as already configured."""
    MockConfigEntry(
        domain=DOMAIN, data={CONF_PVM_URL: pvm_url}, unique_id=pvm_url
    ).add_to_hass(hass)

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    with patch("custom_components.pvm.config_flow._validate", return_value=None):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {CONF_PVM_URL: pvm_url}
        )

    assert result["type"] == data_entry_flow.FlowResultType.ABORT
    assert result["reason"] == "already_configured"


async def test_reauth_flow(hass: HomeAssistant, mock_entry: MockConfigEntry) -> None:
    """The reauth flow validates a new token and reloads the entry."""
    mock_entry.add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(
        DOMAIN,
        context={
            "source": config_entries.SOURCE_REAUTH,
            "entry_id": mock_entry.entry_id,
            "unique_id": mock_entry.unique_id,
        },
        data=mock_entry.data,
    )
    assert result["type"] == data_entry_flow.FlowResultType.FORM
    assert result["step_id"] == "reauth_confirm"

    with patch("custom_components.pvm.config_flow._validate", return_value=None), patch.object(
        hass.config_entries, "async_reload", return_value=None
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {CONF_PVM_TOKEN: "new-token"}
        )

    assert result["type"] == data_entry_flow.FlowResultType.ABORT
    assert result["reason"] == "reauth_successful"


async def test_options_flow(hass: HomeAssistant, mock_entry: MockConfigEntry) -> None:
    """The options flow persists scan interval and SSL settings."""
    mock_entry.add_to_hass(hass)
    result = await hass.config_entries.options.async_init(mock_entry.entry_id)
    assert result["type"] == data_entry_flow.FlowResultType.FORM
    assert result["step_id"] == "init"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {CONF_SCAN_INTERVAL: 60, "verify_ssl": False, CONF_PVM_TOKEN: "t2"},
    )
    assert result["type"] == data_entry_flow.FlowResultType.CREATE_ENTRY
    assert result["data"][CONF_SCAN_INTERVAL] == 60
    assert result["data"]["verify_ssl"] is False
