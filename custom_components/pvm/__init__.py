"""PVM (PV-Manager) Home Assistant custom component.

Bridges Home Assistant and the standalone PVM Node.js backend:

* Registers a sidebar panel (``panel_custom``) that embeds the PVM web UI.
* Exposes HA services under the ``pvm`` domain used by the PVM backend and by
  HA automations/scripts.
* Proxies the PVM REST API through an authenticated HA view so the UI runs
  same-origin and never exposes the PVM API token to the browser.

The component is intentionally thin: all PV logic lives in the PVM backend.
"""

from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_PVM_TOKEN,
    CONF_PVM_URL,
    DOMAIN,
    SERVICE_SCHEMA,
    SERVICES,
)
from .coordinator import PvmCoordinator
from .panel import async_register_panel, async_unregister_panel
from .proxy import VIEW_NAME, PvmProxyView

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

_PROXY_KEY = f"{DOMAIN}_proxy_registered"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the PVM component (YAML configuration is not supported)."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up PVM from a config entry."""
    pvm_url: str = entry.options.get(CONF_PVM_URL, entry.data[CONF_PVM_URL])
    pvm_token: str = entry.options.get(
        CONF_PVM_TOKEN, entry.data.get(CONF_PVM_TOKEN, "")
    )

    coordinator = PvmCoordinator(hass, pvm_url, pvm_token, entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    # Same-origin authenticated proxy for the PVM API (registered once).
    if not hass.data.get(_PROXY_KEY) and not _view_registered(hass):
        hass.http.register_view(PvmProxyView(hass))
        hass.data[_PROXY_KEY] = True

    await async_register_panel(hass, entry, pvm_url)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    _register_services(hass)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


def _view_registered(hass: HomeAssistant) -> bool:
    """Best-effort check whether the proxy route already exists."""
    try:
        return any(
            getattr(route, "name", None) == VIEW_NAME
            for route in hass.http.app.router.routes()
        )
    except Exception:  # noqa: BLE001 - router introspection is best-effort
        return False


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if not hass.data[DOMAIN]:
            async_unregister_panel(hass)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the entry when options change."""
    await hass.config_entries.async_reload(entry.entry_id)


def _register_services(hass: HomeAssistant) -> None:
    """Register the ``pvm.*`` services exactly once."""

    def _make_handler(service: str):
        async def handler(call: ServiceCall) -> None:
            coordinator: PvmCoordinator | None = next(
                iter(hass.data[DOMAIN].values()), None
            )
            if coordinator is None:
                raise HomeAssistantError("PVM integration is not loaded")
            payload = {key: call.data[key] for key in call.data if key in _ALLOWED_KEYS}
            await coordinator.async_call_service(service, payload)

        return handler

    for service in SERVICES:
        if hass.services.has_service(DOMAIN, service):
            continue
        hass.services.async_register(
            DOMAIN,
            service,
            _make_handler(service),
            schema=SERVICE_SCHEMA.get(service, vol.Schema({}, extra=vol.ALLOW_EXTRA)),
        )


_ALLOWED_KEYS = {
    "device_id",
    "entity_id",
    "power",
    "state",
    "temperature",
    "start",
    "end",
    "plan",
    "horizon",
    "history",
    "battery_level_percent",
    "battery_capacity_wh",
}
