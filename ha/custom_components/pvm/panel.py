"""Register/unregister the PVM sidebar panel in Home Assistant."""

from __future__ import annotations

import logging

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, PANEL_ICON, PANEL_TITLE, PANEL_URL_PATH, PANEL_WEBCOMPONENT

_LOGGER = logging.getLogger(__name__)

STATIC_URL = "/pvm_static"


async def async_register_panel(hass: HomeAssistant, entry: ConfigEntry, pvm_url: str) -> None:
    """Register the static assets and the custom sidebar panel."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, hass.config.path("custom_components/pvm/www"), False)]
    )

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
    """Remove the PVM sidebar panel."""
    frontend = hass.data.get("frontend_panels", {})
    if PANEL_URL_PATH in frontend:
        frontend.pop(PANEL_URL_PATH, None)
    _LOGGER.debug("PVM panel unregistered")
