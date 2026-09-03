"""Automatische Erstellung des PVM-Dashboards.

Nutzt exakt denselben Mechanismus wie Home Assistant selbst (z. B. für das
Map-Dashboard): Die Dashboard-Definition wird über die Lovelace-Storage-
Collection angelegt und die Karten über ``LovelaceStorage`` gespeichert.

Wichtig:
- Idempotent: Ein vorhandenes Dashboard wird nie ungefragt überschrieben –
  nur bei Struktur-/Design-Änderungen („force_rebuild“) aktualisiert.
- Fehlertolerant: Schlägt die Erstellung fehl, wird nur gewarnt – die
  Integration läuft trotzdem weiter (Button „Dashboard aktualisieren“ bzw.
  der Service ``pvm.rebuild_dashboard`` erstellt es später neu).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component

from .const import (
    DASHBOARD_CREATE_RETRIES,
    DASHBOARD_CREATE_RETRY_DELAY_S,
    DASHBOARD_ICON,
    DASHBOARD_TITLE,
    DASHBOARD_URL_PATH,
    DEFAULT_UI_THEME,
    DOMAIN,
)
from .dashboard_builder import DashboardModel, DeviceView, build_dashboard_config
from .manager import PvmManager

_LOGGER = logging.getLogger(__name__)

LOVELACE_DOMAIN = "lovelace"

# Entitäten-Schlüssel → eindeutiger Präfix der unique_id (global oder Gerät)
GLOBAL_IDS = {
    "surplus": "pvm_surplus",
    "engine_status": "pvm_status",
    "setup": "pvm_setup",
    "reserve": "pvm_reserve",
    "cycle": "pvm_cycle",
    "min_on": "pvm_min_on",
    "min_off": "pvm_min_off",
    "mode": "pvm_mode",
    "theme": "pvm_theme",
    "scan": "pvm_scan",
    "rebuild": "pvm_rebuild",
    "group_global": "pvm_group_global",
}

DEVICE_PREFIXES = {
    "rank": "pvm_rank",
    "status": "pvm_status",
    "up": "pvm_prio_up",
    "down": "pvm_prio_down",
    "auto": "pvm_auto",
    "power_charge": "pvm_power_charge",
    "grid_min": "pvm_grid_min",
    "grid_deadline": "pvm_grid_deadline",
    "grid_fallback": "pvm_grid_fallback",
    "comfort": "pvm_comfort",
    "safety": "pvm_safety",
    "nominal": "pvm_nominal",
    "power_limit": "pvm_power_limit",
    "min_on_power": "pvm_min_on_power",
    "min_soc": "pvm_min_soc",
    "max_soc": "pvm_max_soc",
    "deadline_soc": "pvm_deadline_soc",
    "deadline_time": "pvm_deadline_time",
    "test_start": "pvm_wp_test_start",
    "test_abort": "pvm_wp_test_abort",
    "wp_test_result": "pvm_wp_test_result",
    "options": "pvm_group",
}


def _entity_id_for(registry: er.EntityRegistry, platform: str, unique_id: str) -> str | None:
    """Ermittelt die entity_id einer bekannten unique_id."""
    return registry.async_get_entity_id(platform, DOMAIN, unique_id)


def collect_model(manager: PvmManager) -> DashboardModel:
    """Sammelt die aktuellen Entitäten und baut das Dashboard-Modell."""
    registry = er.async_get(manager.hass)
    model = DashboardModel()
    model.theme = manager.config.get("settings", {}).get("ui_theme", DEFAULT_UI_THEME)
    model.setup = manager.setup_stage()
    model.options_path = (
        f"/config/config_entries/entry/{manager.entry.entry_id}"
    )

    for key, unique in GLOBAL_IDS.items():
        entity_id = _entity_id_for(registry, _platform_of(key), unique)
        if entity_id:
            model.global_entities[key] = entity_id

    energy = manager.config.get("energy", {})
    for role_key, cfg_key in (
        ("pv", "pv_sensor"),
        ("grid", "grid_sensor"),
        ("house", "house_sensor"),
    ):
        if energy.get(cfg_key):
            model.energy[role_key] = energy[cfg_key]

    for index, device in enumerate(manager.config.get("devices", [])):
        device_id = device["id"]
        view = DeviceView(
            id=device_id,
            name=str(device.get("name", "Gerät")),
            role=str(device.get("role")),
            priority=index + 1,
        )
        role = device.get("role")
        for kind, prefix in DEVICE_PREFIXES.items():
            if kind not in _kinds_for_role(role):
                continue
            entity_id = _entity_id_for(registry, _platform_of(kind), f"{prefix}_{device_id}")
            if entity_id:
                view.entities[kind] = entity_id
        sensors = device.get("sensors", {})
        for source_key, cfg_key in (("soc", "soc"), ("temp", "temp"), ("power", "power")):
            if sensors.get(cfg_key):
                view.source[source_key] = sensors[cfg_key]
        model.devices.append(view)

    # Vorschläge aus dem letzten Scan (für die „Gefunden“-Karten)
    scan = manager.last_scan or {}
    model.suggestions = [
        {
            "role": found.get("role", ""),
            "title": found.get("title", ""),
        }
        for found in scan.get("sets", [])
    ][:5]
    return model


def _kinds_for_role(role: str) -> set[str]:
    """Welche Entitäten-Kinds eine Rolle besitzt (Spiegel der Plattformen)."""
    base = {"rank", "status", "up", "down", "auto", "options"}
    if role == "wallbox":
        base |= {
            "power_charge",
            "grid_min",
            "grid_deadline",
            "min_soc",
            "max_soc",
            "deadline_soc",
            "deadline_time",
            "power_limit",
            "min_on_power",
        }
    elif role == "waermepumpe":
        base |= {
            "grid_fallback",
            "comfort",
            "safety",
            "test_start",
            "test_abort",
            "wp_test_result",
        }
    elif role == "verbraucher":
        base |= {"nominal"}
    return base


def _platform_of(kind: str) -> str:
    platforms = {
        "surplus": "sensor",
        "engine_status": "sensor",
        "setup": "sensor",
        "scan": "button",
        "rebuild": "button",
        "mode": "select",
        "theme": "select",
        "reserve": "number",
        "cycle": "number",
        "min_on": "number",
        "min_off": "number",
        "group_global": "switch",
        "rank": "sensor",
        "status": "sensor",
        "up": "button",
        "down": "button",
        "auto": "switch",
        "options": "switch",
        "power_charge": "switch",
        "grid_min": "switch",
        "grid_deadline": "switch",
        "grid_fallback": "switch",
        "comfort": "number",
        "safety": "number",
        "nominal": "number",
        "power_limit": "number",
        "min_on_power": "number",
        "min_soc": "number",
        "max_soc": "number",
        "deadline_soc": "number",
        "deadline_time": "time",
        "test_start": "button",
        "test_abort": "button",
        "wp_test_result": "sensor",
    }
    return platforms.get(kind, "sensor")


async def _async_ensure_lovelace(hass: HomeAssistant) -> bool:
    """Stellt sicher, dass die Lovelace-Komponente geladen ist."""
    if LOVELACE_DOMAIN in hass.config.components:
        return True
    try:
        await async_setup_component(hass, LOVELACE_DOMAIN, {})
        return LOVELACE_DOMAIN in hass.config.components
    except Exception:  # noqa: BLE001
        _LOGGER.exception("PVM: Lovelace-Komponente konnte nicht geladen werden")
        return False


async def async_ensure_dashboard(
    manager: PvmManager, force_rebuild: bool = False
) -> dict[str, Any]:
    """Erstellt/aktualisiert das PVM-Dashboard.

    Liefert einen Statusbericht. Wirft nie – alle Fehler werden geloggt.
    """
    hass = manager.hass
    result: dict[str, Any] = {"created": False, "updated": False, "errors": []}

    try:
        if not await _async_ensure_lovelace(hass):
            result["errors"].append("lovelace_not_loaded")
            return result

        from homeassistant.components.lovelace import dashboard as ll_dashboard
        from homeassistant.components.lovelace.const import (
            CONF_ICON,
            CONF_SHOW_IN_SIDEBAR,
            CONF_TITLE,
            CONF_URL_PATH,
            LOVELACE_DATA,
            MODE_STORAGE,
        )

        data = hass.data.get(LOVELACE_DATA)
        if data is None:
            result["errors"].append("lovelace_data_missing")
            return result

        # 1) Dashboard-Eintrag (persistiert in .storage/lovelace_dashboards)
        collection = ll_dashboard.DashboardsCollection(hass)
        await collection.async_load()
        item = next(
            (
                it
                for it in collection.async_items()
                if it.get(CONF_URL_PATH) == DASHBOARD_URL_PATH
            ),
            None,
        )
        if item is None:
            item = await collection.async_create_item(
                {
                    CONF_URL_PATH: DASHBOARD_URL_PATH,
                    CONF_TITLE: DASHBOARD_TITLE,
                    CONF_ICON: DASHBOARD_ICON,
                    CONF_SHOW_IN_SIDEBAR: True,
                    "mode": MODE_STORAGE,
                }
            )
            result["created"] = True

        # 2) Live-Instanz im laufenden Hass registrieren (Sidebar!)
        store = data.dashboards.get(DASHBOARD_URL_PATH)
        if store is None:
            store = ll_dashboard.LovelaceStorage(hass, item)
            data.dashboards[DASHBOARD_URL_PATH] = store
            try:
                from homeassistant.components.frontend import (
                    async_register_built_in_panel,
                )

                async_register_built_in_panel(
                    hass,
                    LOVELACE_DOMAIN,
                    sidebar_title=DASHBOARD_TITLE,
                    sidebar_icon=DASHBOARD_ICON,
                    frontend_url_path=DASHBOARD_URL_PATH,
                    config={"mode": MODE_STORAGE},
                    require_admin=False,
                    update=False,
                )
            except Exception:  # noqa: BLE001 – Panel existiert evtl. schon
                _LOGGER.debug("PVM: Panel-Registrierung übersprungen", exc_info=True)

        # 3) Karten speichern (nur beim Erstellen oder explizitem Rebuild)
        if result["created"] or force_rebuild:
            config = build_dashboard_config(collect_model(manager))
            await store.async_save(config)
            result["updated"] = True
            result["views"] = len(config.get("views", []))
            # Einmaliger Kurzhinweis direkt nach der Installation
            if result["created"] and not result["errors"]:
                manager.hass.components.persistent_notification.async_create(
                    title="PV Manager ist bereit ☀️",
                    message=(
                        "Weitere Einrichtung und Einstellungen findest du im "
                        "**PV-Manager-Dashboard** in der Seitenleiste "
                        "(Start-Seite mit kurzer Anleitung)."
                    ),
                    notification_id=f"{DOMAIN}_dashboard_ready",
                )

        _LOGGER.info(
            "PVM: Dashboard %s (%s)",
            "erstellt" if result["created"] else "vorhanden",
            DASHBOARD_URL_PATH,
        )
    except Exception as err:  # noqa: BLE001
        result["errors"].append(f"{type(err).__name__}: {err}")
        _LOGGER.warning("PVM: Dashboard-Erstellung fehlgeschlagen: %s", err)
    return result


async def async_rebuild_dashboard(manager: PvmManager, notify: bool = False) -> None:
    """Erstellt/aktualisiert das Dashboard und informiert optional."""
    result = await async_ensure_dashboard(manager, force_rebuild=True)
    if notify:
        if not result["errors"]:
            manager.hass.components.persistent_notification.async_create(
                title="PVM – Dashboard",
                message=(
                    "Das Dashboard **PV Manager** wurde aktualisiert. "
                    "Öffne es über die Seitenleiste."
                ),
                notification_id=f"{DOMAIN}_dashboard",
            )
        else:
            manager.hass.components.persistent_notification.async_create(
                title="PVM – Dashboard",
                message=(
                    "Das Dashboard konnte nicht aktualisiert werden.\n\n"
                    + "\n".join(f"- `{e}`" for e in result["errors"])
                    + "\n\nDetails findest du im Home-Assistant-Log."
                ),
                notification_id=f"{DOMAIN}_dashboard",
            )


def schedule_dashboard_creation(
    manager: PvmManager, force_rebuild: bool = False
) -> None:
    """Startet die Dashboard-Erstellung im Hintergrund (mit Wiederholungen)."""

    async def _create_with_retries() -> None:
        for _attempt in range(1, DASHBOARD_CREATE_RETRIES + 1):
            if manager.closing:
                return
            result = await async_ensure_dashboard(manager, force_rebuild=force_rebuild)
            if not result["errors"]:
                return
            await asyncio.sleep(DASHBOARD_CREATE_RETRY_DELAY_S)
        _LOGGER.warning(
            "PVM: Dashboard-Erstellung nach %d Versuchen abgebrochen – "
            "Service pvm.rebuild_dashboard erstellt es später neu.",
            DASHBOARD_CREATE_RETRIES,
        )

    manager.hass.async_create_task(
        _create_with_retries(), name=f"{DOMAIN}_dashboard_create"
    )
