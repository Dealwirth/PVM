"""Baut die Lovelace-Konfiguration für das PVM-Dashboard (reines Python).

Erzeugt ein Dict, das exakt dem Lovelace-Storage-Format entspricht
(``{"title": ..., "views": [...]}``). Es werden ausschließlich Standard-Karten
verwendet. Fehlende optionale Entitäten werden einfach weggelassen.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .const import (
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
)


@dataclass
class DeviceView:
    """Eine Geräte-Sektion für das Dashboard."""

    id: str
    name: str
    role: str
    priority: int  # 1 = höchste
    entities: dict[str, str] = field(default_factory=dict)  # kind -> entity_id
    source: dict[str, str] = field(default_factory=dict)  # z. B. soc/temp/power sensor


@dataclass
class DashboardModel:
    """Alle Daten, die das Dashboard benötigt."""

    global_entities: dict[str, str] = field(default_factory=dict)
    energy: dict[str, str] = field(default_factory=dict)  # pv/grid/house -> entity_id
    devices: list[DeviceView] = field(default_factory=list)
    surplus_unit: str = "W"


def _tile(entity: str, icon: str | None = None, name: str | None = None) -> dict:
    card: dict = {"type": "tile", "entity": entity}
    if icon:
        card["icon"] = icon
    if name:
        card["name"] = name
    return card


def _markdown(content: str) -> dict:
    return {"type": "markdown", "content": content}


def _grid(cards: list[dict], columns: int | None = None) -> dict:
    card: dict = {"type": "grid", "cards": cards}
    if columns:
        card["columns"] = columns
    return card


def _entities(entities: list[str], title: str | None = None) -> dict:
    card: dict = {"type": "entities", "entities": entities}
    if title:
        card["title"] = title
    return card


def build_dashboard_config(model: DashboardModel) -> dict:
    """Baut die komplette Lovelace-Konfiguration."""
    views: list[dict] = []

    # ------------------------------------------------------------------
    # Ansicht 1: Übersicht
    # ------------------------------------------------------------------
    energy_tiles: list[dict] = []
    if model.energy.get("pv"):
        energy_tiles.append(_tile(model.energy["pv"], "mdi:solar-power", "PV-Leistung"))
    if model.energy.get("grid"):
        energy_tiles.append(_tile(model.energy["grid"], "mdi:transmission-tower", "Netz"))
    if model.energy.get("house"):
        energy_tiles.append(_tile(model.energy["house"], "mdi:home", "Hausverbrauch"))
    if model.global_entities.get("surplus"):
        energy_tiles.append(_tile(model.global_entities["surplus"], "mdi:solar-power", "Überschuss"))

    overview_cards: list[dict] = []
    if energy_tiles:
        overview_cards.append(_grid(energy_tiles))

    status_entities: list[str] = []
    if model.global_entities.get("mode"):
        status_entities.append(model.global_entities["mode"])
    if model.global_entities.get("reserve"):
        status_entities.append(model.global_entities["reserve"])
    if model.global_entities.get("engine_status"):
        overview_cards.append(
            {
                "type": "tile",
                "entity": model.global_entities["engine_status"],
                "icon": "mdi:heart-pulse",
                "name": "PVM-Status",
            }
        )
    if status_entities:
        overview_cards.append(_entities(status_entities, "Modus & Reserve"))

    graph_entities: list[dict] = []
    for key, label in (
        ("surplus", "Überschuss"),
        ("grid", "Netz"),
        ("pv", "PV"),
    ):
        if model.global_entities.get(key):
            graph_entities.append({"entity": model.global_entities[key], "name": label})
        elif key == "grid" and model.energy.get("grid"):
            graph_entities.append({"entity": model.energy["grid"], "name": label})
    if len(graph_entities) >= 1:
        overview_cards.append(
            {"type": "history-graph", "title": "Verlauf", "entities": graph_entities}
        )

    views.append({"title": "Übersicht", "cards": overview_cards})

    # ------------------------------------------------------------------
    # Ansicht 2: Prioritäten
    # ------------------------------------------------------------------
    prio_cards: list[dict] = [_markdown("## Prioritäten\n_1 = wird zuerst versorgt_")]
    for dev in sorted(model.devices, key=lambda d: d.priority):
        row: list[dict] = []
        rank_sensor = dev.entities.get("rank")
        if rank_sensor:
            row.append(_tile(rank_sensor, "mdi:sort-numeric-ascending", "Rang"))
        if dev.entities.get("up"):
            row.append({"type": "button", "entity": dev.entities["up"], "icon": "mdi:chevron-up"})
        if dev.entities.get("down"):
            row.append({"type": "button", "entity": dev.entities["down"], "icon": "mdi:chevron-down"})
        if dev.entities.get("auto"):
            row.append({"type": "button", "entity": dev.entities["auto"], "icon": "mdi:toggle-switch"})
        if row:
            prio_cards.append(
                _grid(
                    [
                        _markdown(f"### {dev.name}"),
                        {"type": "horizontal-stack", "cards": row},
                    ]
                )
            )
    if not prio_cards[1:]:
        prio_cards.append(_markdown("_Noch keine Geräte konfiguriert._"))
    views.append({"title": "Prioritäten", "cards": prio_cards})

    # ------------------------------------------------------------------
    # Ansicht 3: Geräte
    # ------------------------------------------------------------------
    device_cards: list[dict] = []
    for dev in sorted(model.devices, key=lambda d: d.priority):
        cards: list[dict] = []

        if dev.role == ROLE_WALLBOX:
            soc = dev.source.get("soc")
            if soc:
                cards.append(
                    {
                        "type": "gauge",
                        "entity": soc,
                        "name": "SoC",
                        "min": 0,
                        "max": 100,
                        "unit": "%",
                    }
                )
            power = dev.source.get("power")
            tiles = []
            if power:
                tiles.append(_tile(power, "mdi:ev-station", "Ladeleistung"))
            for kind, icon, label in (
                ("power_charge", "mdi:lightning-bolt", "Power Charge"),
                ("status", "mdi:information-outline", "Status"),
            ):
                if dev.entities.get(kind):
                    tiles.append(_tile(dev.entities[kind], icon, label))
            if tiles:
                cards.append({"type": "horizontal-stack", "cards": tiles})

            entity_rows = [
                dev.entities[k] for k in ("auto", "grid_min", "grid_deadline") if dev.entities.get(k)
            ]
            number_rows = [
                dev.entities[k] for k in ("min_soc", "max_soc", "deadline_soc", "deadline_time") if dev.entities.get(k)
            ]
            if entity_rows or number_rows:
                cards.append(
                    _entities(entity_rows + number_rows, "Ladeziele & Optionen")
                )

        elif dev.role == ROLE_WAERMEPUMPE:
            temp = dev.source.get("temp")
            if temp:
                cards.append(
                    {
                        "type": "gauge",
                        "entity": temp,
                        "name": "Temperatur",
                        "min": 20,
                        "max": 80,
                        "unit": "°C",
                    }
                )
            tiles = []
            for kind, icon, _label in (
                ("test_start", "mdi:play", "WP-Test starten"),
                ("test_abort", "mdi:stop", "Test abbrechen"),
                ("status", "mdi:information-outline", "Status"),
            ):
                if dev.entities.get(kind):
                    tiles.append(
                        {"type": "button", "entity": dev.entities[kind], "icon": icon}
                    )
            if dev.entities.get("status"):
                tiles.append(_tile(dev.entities["status"], None, None))
            if tiles:
                cards.append({"type": "horizontal-stack", "cards": tiles})
            rows = [
                dev.entities[k]
                for k in ("auto", "comfort", "grid_fallback", "wp_test_result")
                if dev.entities.get(k)
            ]
            if rows:
                cards.append(_entities(rows, "Wärmepumpe"))

        else:  # Verbraucher
            tiles = []
            for kind, icon, label in (
                ("status", "mdi:information-outline", "Status"),
            ):
                if dev.entities.get(kind):
                    tiles.append(_tile(dev.entities[kind], icon, label))
            if tiles:
                cards.append({"type": "horizontal-stack", "cards": tiles})
            rows = [dev.entities[k] for k in ("auto",) if dev.entities.get(k)]
            if rows:
                cards.append(_entities(rows, "Verbraucher"))

        device_cards.append(_markdown(f"### {dev.name}"))
        if cards:
            device_cards.append({"type": "vertical-stack", "cards": cards})
        else:
            device_cards.append(_markdown("_Keine Entitäten konfiguriert._"))

    if not model.devices:
        device_cards.append(
            _markdown(
                "_Noch keine Geräte. Öffne die Integrations-Optionen "
                "(⚙ → PV Manager) und füge Geräte hinzu._"
            )
        )
    views.append({"title": "Geräte", "cards": device_cards})

    # ------------------------------------------------------------------
    # Ansicht 4: Einstellungen
    # ------------------------------------------------------------------
    settings_rows: list[str] = []
    for key in ("mode", "reserve"):
        if model.global_entities.get(key):
            settings_rows.append(model.global_entities[key])
    settings_cards: list[dict] = []
    if settings_rows:
        settings_cards.append(_entities(settings_rows, "Globale Einstellungen"))
    for key, label in (
        ("scan", "Geräte suchen"),
        ("rebuild", "Dashboard aktualisieren"),
    ):
        if model.global_entities.get(key):
            settings_cards.append(
                {"type": "button", "entity": model.global_entities[key], "name": label}
            )
    settings_cards.append(
        _markdown(
            "**Tipp:** Alle Werte lassen sich auch direkt anklicken. "
            "Weitere Optionen (Zykluszeit, WP-Test-Parameter) findest du "
            "unter Einstellungen → Geräte & Dienste → PV Manager."
        )
    )
    views.append({"title": "Einstellungen", "cards": settings_cards})

    return {"title": "PV Manager", "views": views}
