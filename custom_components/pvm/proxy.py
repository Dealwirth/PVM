"""Authenticated same-origin proxy for the PVM REST API.

Serves ``/api/pvm/<path>`` inside Home Assistant and forwards it to the PVM
backend with the stored PVM token. This keeps the PVM API token out of the
browser and avoids CORS, so the embedded panel can talk to PVM same-origin.

The view is registered once per HA instance and resolves the active
coordinator at request time, so config-entry reloads do not re-register it.
"""

from __future__ import annotations

import logging

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PROXY_PREFIX = "/api/pvm"
VIEW_NAME = "api:pvm:proxy"


def _resolve_coordinator(hass: HomeAssistant):
    """Return an active coordinator, or ``None`` if the integration is unloaded."""
    entries = hass.data.get(DOMAIN, {})
    return next(iter(entries.values()), None)


class PvmProxyView(HomeAssistantView):
    """Proxy PVM API requests through Home Assistant."""

    url = f"{PROXY_PREFIX}/{{path:.*}}"
    name = VIEW_NAME
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def _forward(self, request: web.Request, path: str) -> web.Response:
        coordinator = _resolve_coordinator(self.hass)
        if coordinator is None:
            return self.json(
                {"error": {"code": "PVM-010", "message": "PVM integration is not loaded"}},
                status_code=503,
            )
        target = f"/api/{path}"
        payload = None
        if request.can_read_body:
            try:
                payload = await request.json()
            except ValueError:
                payload = None
        status, body = await coordinator.async_request(request.method, target, payload)
        if isinstance(body, (dict, list)):
            return self.json(body, status_code=status)
        return web.Response(text=str(body), status=status)

    async def get(self, request: web.Request, path: str) -> web.Response:
        return await self._forward(request, path)

    async def post(self, request: web.Request, path: str) -> web.Response:
        return await self._forward(request, path)

    async def put(self, request: web.Request, path: str) -> web.Response:
        return await self._forward(request, path)

    async def delete(self, request: web.Request, path: str) -> web.Response:
        return await self._forward(request, path)

