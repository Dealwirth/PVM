"""Config flow for the PVM custom component."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult

from .const import (
    CONF_PVM_TOKEN,
    CONF_PVM_URL,
    CONF_SCAN_INTERVAL,
    CONF_VERIFY_SSL,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MIN_SCAN_INTERVAL,
)

_LOGGER = logging.getLogger(__name__)

STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_PVM_URL, default="http://localhost:7000"): str,
        vol.Optional(CONF_PVM_TOKEN, default=""): str,
        vol.Optional(CONF_VERIFY_SSL, default=True): bool,
        vol.Optional(CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL): vol.All(
            int, vol.Range(min=MIN_SCAN_INTERVAL)
        ),
    }
)


async def _validate(hass: HomeAssistant, data: dict[str, Any]) -> None:
    """Validate the endpoint by calling the PVM health API."""
    from homeassistant.helpers.aiohttp_client import async_get_clientsession

    session = async_get_clientsession(hass, data.get(CONF_VERIFY_SSL, True))
    url = f"{data[CONF_PVM_URL].rstrip('/')}/api/health"
    headers = {}
    if data.get(CONF_PVM_TOKEN):
        headers["Authorization"] = f"Bearer {data[CONF_PVM_TOKEN]}"
    async with session.get(url, headers=headers, timeout=10) as resp:
        if resp.status != 200:
            raise ConnectionError(f"PVM health returned HTTP {resp.status}")


class PvmConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the initial setup flow."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                await _validate(self.hass, user_input)
            except Exception:  # noqa: BLE001 - surface as a form error
                _LOGGER.exception("PVM connection validation failed")
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(user_input[CONF_PVM_URL])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="PVM", data=user_input)

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_SCHEMA, errors=errors
        )

    @staticmethod
    @config_entries.callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        return PvmOptionsFlow(config_entry)


class PvmOptionsFlow(config_entries.OptionsFlow):
    """Handle options (scan interval, token) updates."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        current = {**self.config_entry.data, **self.config_entry.options}
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_SCAN_INTERVAL,
                    default=current.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
                ): vol.All(int, vol.Range(min=MIN_SCAN_INTERVAL)),
                vol.Optional(CONF_PVM_TOKEN, default=current.get(CONF_PVM_TOKEN, "")): str,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
