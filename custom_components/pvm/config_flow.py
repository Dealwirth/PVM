"""Config flow for the PVM custom component."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_PVM_TOKEN,
    CONF_PVM_URL,
    CONF_SCAN_INTERVAL,
    CONF_VERIFY_SSL,
    DEFAULT_PVM_URL,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MIN_SCAN_INTERVAL,
    normalize_pvm_url,
)

_LOGGER = logging.getLogger(__name__)

STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_PVM_URL, default=DEFAULT_PVM_URL): str,
        vol.Optional(CONF_PVM_TOKEN, default=""): str,
        vol.Optional(CONF_VERIFY_SSL, default=True): bool,
        vol.Optional(CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL): vol.All(
            int, vol.Range(min=MIN_SCAN_INTERVAL)
        ),
    }
)


class CannotConnect(Exception):
    """Raised when the PVM backend is unreachable or rejects the token."""

    def __init__(self, reason: str = "cannot_connect") -> None:
        super().__init__(reason)
        self.reason = reason


async def _validate(hass: HomeAssistant, data: dict[str, Any]) -> None:
    """Validate the endpoint by calling the PVM health API.

    Raises :class:`CannotConnect` with a specific ``reason`` so the form can
    show an actionable message instead of a generic failure.
    """
    session = async_get_clientsession(hass, data.get(CONF_VERIFY_SSL, True))
    url = f"{normalize_pvm_url(data[CONF_PVM_URL])}/api/health"
    headers = {}
    if data.get(CONF_PVM_TOKEN):
        headers["Authorization"] = f"Bearer {data[CONF_PVM_TOKEN]}"
    try:
        async with session.get(url, headers=headers, timeout=10) as resp:
            if resp.status in (401, 403):
                raise CannotConnect("invalid_auth")
            if resp.status != 200:
                raise CannotConnect("cannot_connect")
    except CannotConnect:
        raise
    except Exception as err:  # noqa: BLE001 - surfaced as a form error
        raise CannotConnect("cannot_connect") from err


class PvmConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the initial setup flow."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            url = normalize_pvm_url(user_input[CONF_PVM_URL])
            user_input[CONF_PVM_URL] = url
            await self.async_set_unique_id(url)
            self._abort_if_unique_id_configured()
            try:
                await _validate(self.hass, user_input)
            except CannotConnect as err:
                errors["base"] = err.reason
            except Exception:  # noqa: BLE001 - surface as a form error
                _LOGGER.exception("PVM connection validation failed")
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(title="PVM", data=user_input)

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_SCHEMA, errors=errors
        )

    async def async_step_import(self, import_data: dict[str, Any]) -> FlowResult:
        """Import configuration from YAML (single-instance)."""
        import_data = dict(import_data)
        import_data[CONF_PVM_URL] = normalize_pvm_url(import_data[CONF_PVM_URL])
        await self.async_set_unique_id(import_data[CONF_PVM_URL])
        self._abort_if_unique_id_configured()
        return self.async_create_entry(title="PVM", data=import_data)

    async def async_step_reauth(self, entry_data: dict[str, Any]) -> FlowResult:
        """Handle re-authentication when the stored token is rejected."""
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        errors: dict[str, str] = {}
        entry = self._get_reauth_entry()
        if user_input is not None:
            new_data = {**entry.data, **user_input}
            try:
                await _validate(self.hass, new_data)
            except CannotConnect as err:
                errors["base"] = err.reason
            except Exception:  # noqa: BLE001
                _LOGGER.exception("PVM re-auth validation failed")
                errors["base"] = "cannot_connect"
            else:
                self.hass.config_entries.async_update_entry(entry, data=new_data)
                await self.hass.config_entries.async_reload(entry.entry_id)
                return self.async_abort(reason="reauth_successful")
        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema({vol.Required(CONF_PVM_TOKEN): str}),
            errors=errors,
        )

    @staticmethod
    @config_entries.callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        return PvmOptionsFlow()


class PvmOptionsFlow(config_entries.OptionsFlow):
    """Handle options (scan interval, token, SSL) updates."""

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
                vol.Optional(
                    CONF_VERIFY_SSL,
                    default=current.get(CONF_VERIFY_SSL, True),
                ): bool,
                vol.Optional(CONF_PVM_TOKEN, default=current.get(CONF_PVM_TOKEN, "")): str,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)

