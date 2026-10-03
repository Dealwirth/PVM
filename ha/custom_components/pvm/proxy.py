"""Authenticated same-origin proxy for the PVM REST API.

Serves ``/api/pvm/<path>`` inside Home Assistant and forwards it to the PVM
backend with the stored PVM token. This keeps the PVM API token out of the
browser and avoids CORS, so the embedded panel can talk to PVM same-origin.
"""

from __future__ import annotations

import logging

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PROXY_PREFIX = "/api/pvm"


class PvmProxyView(HomeAssistantView):
    """Proxy PVM API requests through Home Assistant."""

    url = f"{PROXY_PREFIX}/{{path:.*}}"
    name = "api:pvm:proxy"
    requires_auth = True

    def __init__(self, coordinator) -> None:
        self.coordinator = coordinator

    async def _forward(self, request: web.Request, path: str) -> web.Response:
        method = request.method
        target = f"/api/{path}"
        payload = None
        if request.can_read_body:
            try:
                payload = await request.json()
            except ValueError:
                payload = None
        status, body = await self.coordinator.async_request(method, target, payload)
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
