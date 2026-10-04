"""Register/unregister the PVM sidebar panel in Home Assistant."""

from __future__ import annotations

import logging

from homeassistant.components import panel_custom
from homeassistant.components.frontend import async_remove_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PANEL_ICON, PANEL_TITLE, PANEL_URL_PATH, PANEL_WEBCOMPONENT

_LOGGER = logging.getLogger(__name__)

STATIC_URL = "/pvm_static"
_STATIC_KEY = f"{DOMAIN}_static_registered"


async def async_register_panel(hass: HomeAssistant, entry: ConfigEntry, pvm_url: str) -> None:
    """Register the static assets (once) and the custom sidebar panel."""
    if not hass.data.get(_STATIC_KEY):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    STATIC_URL,
                    hass.config.path("custom_components/pvm/www"),
                    False,
                )
            ]
        )
        hass.data[_STATIC_KEY] = True

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_WEBCOMPONENT,
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{STATIC_URL}/pvm-panel.js",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        config={"pvm_url": pvm_url, "proxy_prefix": "/api/pvm"},
        require_admin=False,
        embed_iframe=False,
    )
    _LOGGER.debug("PVM panel registered at /%s", PANEL_URL_PATH)


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Remove the PVM sidebar panel (static path stays registered for the process)."""
    async_remove_panel(hass, PANEL_URL_PATH)
    _LOGGER.debug("PVM panel unregistered")

