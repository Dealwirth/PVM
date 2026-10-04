"""DataUpdateCoordinator for the PVM backend."""

from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed, HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    CONF_PVM_TOKEN,
    CONF_PVM_URL,
    CONF_SCAN_INTERVAL,
    CONF_VERIFY_SSL,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


class PvmCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Poll the PVM dashboard and forward service calls."""

    def __init__(
        self,
        hass: HomeAssistant,
        pvm_url: str,
        pvm_token: str,
        entry: ConfigEntry,
    ) -> None:
        self.pvm_url = pvm_url.rstrip("/")
        self.pvm_token = pvm_token
        self.verify_ssl = entry.options.get(
            CONF_VERIFY_SSL, entry.data.get(CONF_VERIFY_SSL, True)
        )
        interval = entry.options.get(
            CONF_SCAN_INTERVAL, entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
        )
        self._session = async_get_clientsession(hass, self.verify_ssl)
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}:{entry.entry_id}",
            update_interval=timedelta(seconds=interval),
            config_entry=entry,
        )

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.pvm_token:
            headers["Authorization"] = f"Bearer {self.pvm_token}"
        return headers

    async def _async_update_data(self) -> dict[str, Any]:
        try:
            async with self._session.get(
                f"{self.pvm_url}/api/dashboard", headers=self._headers(), timeout=15
            ) as resp:
                if resp.status == 401:
                    raise ConfigEntryAuthFailed("PVM rejected the API token")
                if resp.status != 200:
                    raise UpdateFailed(f"PVM dashboard HTTP {resp.status}")
                return await resp.json()
        except (UpdateFailed, ConfigEntryAuthFailed):
            raise
        except Exception as err:  # noqa: BLE001
            raise UpdateFailed(f"Cannot reach PVM backend: {err}") from err

    async def async_call_service(self, service: str, payload: dict[str, Any]) -> Any:
        """POST a ``pvm.<service>`` call to the PVM backend and return JSON."""
        url = f"{self.pvm_url}/api/ha/services/{service}"
        try:
            async with self._session.post(
                url, json=payload, headers=self._headers(), timeout=15
            ) as resp:
                body = await resp.json(content_type=None)
                if resp.status >= 400:
                    raise HomeAssistantError(
                        f"PVM service {service} failed: {body.get('error', resp.status)}"
                    )
                return body
        except HomeAssistantError:
            raise
        except Exception as err:  # noqa: BLE001
            raise HomeAssistantError(f"PVM service {service} unreachable: {err}") from err

    async def async_request(
        self, method: str, path: str, payload: dict[str, Any] | None = None
    ) -> Any:
        """Generic authenticated passthrough used by the panel proxy."""
        url = f"{self.pvm_url}{path}"
        async with self._session.request(
            method, url, json=payload, headers=self._headers(), timeout=30
        ) as resp:
            text = await resp.text()
            ctype = resp.headers.get("Content-Type", "")
            if "application/json" in ctype or text[:1] in "{[":
                try:
                    return resp.status, json.loads(text)
                except ValueError:
                    pass
            return resp.status, text

    async def async_push_ha_url(self) -> dict[str, Any] | None:
        """Hand PVM the HA base URL(s) so the user only needs to enter the token.

        Best-effort: PVM probes the candidates (and the token it already has)
        and stores the first reachable URL. Failures are logged, never raised,
        so a missing PVM connection cannot block HA setup.
        """
        candidates = _ha_url_candidates(self.hass)
        if not candidates:
            return None
        try:
            async with self._session.post(
                f"{self.pvm_url}/api/ha/internal/detect",
                json={"candidates": candidates},
                headers=self._headers(),
                timeout=15,
            ) as resp:
                if resp.status >= 400:
                    _LOGGER.debug("PVM HA-URL detect returned HTTP %s", resp.status)
                    return None
                return await resp.json(content_type=None)
        except Exception as err:  # noqa: BLE001 - detection is best-effort
            _LOGGER.debug("PVM HA-URL detection failed: %s", err)
            return None


def _ha_url_candidates(hass: HomeAssistant) -> list[str]:
    """Collect HA base URLs the PVM backend might reach.

    ``internal_url`` is preferred (usually the LAN address PVM can reach);
    ``external_url`` and the running API base URL are included as fallbacks.
    """
    candidates: list[str] = []
    for attr in ("internal_url", "external_url"):
        value = getattr(hass.config, attr, None)
        if isinstance(value, str) and value:
            candidates.append(value)
    api = getattr(hass.config, "api", None)
    base_url = getattr(api, "base_url", None) if api is not None else None
    if isinstance(base_url, str) and base_url:
        candidates.append(base_url)
    # Deduplicate while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for url in candidates:
        normalized = url.rstrip("/")
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique.append(normalized)
    return unique

