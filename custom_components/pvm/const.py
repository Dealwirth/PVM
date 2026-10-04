"""Constants for the PVM custom component."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.helpers import config_validation as cv

DOMAIN = "pvm"

CONF_PVM_URL = "pvm_url"
CONF_PVM_TOKEN = "pvm_token"
CONF_VERIFY_SSL = "verify_ssl"
CONF_SCAN_INTERVAL = "scan_interval"

PANEL_TITLE = "PVM"
PANEL_ICON = "mdi:solar-power-variant"
PANEL_URL_PATH = "pvm"
PANEL_WEBCOMPONENT = "pvm-panel"

DEFAULT_PVM_URL = "http://localhost:7000"
DEFAULT_SCAN_INTERVAL = 30
MIN_SCAN_INTERVAL = 5

# HA services exposed under the ``pvm`` domain and forwarded to the backend.
SERVICES = [
    "set_device_state",
    "set_device_power",
    "set_device_temperature",
    "update_plan",
    "get_forecast",
    "get_calendar_events",
    "get_history",
    "get_sensors",
    "get_entities",
    "get_devices",
    "run_planning_cycle",
]

SERVICE_SCHEMA: dict[str, vol.Schema] = {
    "set_device_state": vol.Schema(
        {
            vol.Required("device_id"): cv.string,
            vol.Required("state"): vol.Any(cv.string, cv.boolean),
        }
    ),
    "set_device_power": vol.Schema(
        {
            vol.Required("device_id"): cv.string,
            vol.Required("power"): vol.Coerce(float),
        }
    ),
    "set_device_temperature": vol.Schema(
        {
            vol.Required("device_id"): cv.string,
            vol.Required("temperature"): vol.Coerce(float),
        }
    ),
    "update_plan": vol.Schema({vol.Required("plan"): dict}),
    "get_forecast": vol.Schema(
        {vol.Optional("horizon"): vol.In(["day", "week", "total"])}
    ),
    "get_history": vol.Schema(
        {
            vol.Required("device_id"): cv.string,
            vol.Optional("start"): cv.string,
            vol.Optional("end"): cv.string,
        }
    ),
    "get_calendar_events": vol.Schema({}),
    "get_sensors": vol.Schema({}),
    "get_entities": vol.Schema({}),
    "get_devices": vol.Schema({}),
    "run_planning_cycle": vol.Schema({}),
}
