"""Baut die Lovelace-Konfiguration für das PVM-Dashboard (reines Python).

Erzeugt ein Dict, das exakt dem Lovelace-Storage-Format entspricht
(``{"title": ..., "views": [...]}``). Es werden ausschließlich Standard-Karten
verwendet. Fehlende optionale Entitäten werden einfach weggelassen.

Das Design ist in drei Pakete aufgeteilt (umschaltbar im Dashboard):
- Sonnenaufgang (Standard): warm, hell
- Natur-frisch: grün & sonnig
- Kühl & klar: helles Blaugrün
Die echten Kartenfarben hängen am HA-Theme; PVM setzt Akzente über Icons,
Emojis und Überschriften.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .const import (
    DEFAULT_UI_THEME,
    ROLE_WAERMEPUMPE,
    ROLE_WALLBOX,
    SETUP_LABELS,
    SETUP_MESSUNGEN,
    SETUP_START,
    UI_THEME_SUNRISE,
)

# ---------------------------------------------------------------------------
# Design-Pakete
# ---------------------------------------------------------------------------
PALETTES: dict[str, dict] = {
    UI_THEME_SUNRISE: {
        "name": "☀️ Sonnenaufgang",
        "views": {
            "start": "🌅 Start",
            "overview": "☀️ Übersicht",
            "devices": "🔌 Geräte",
            "priority": "⬆️ Reihenfolge",
            "settings": "🎨 Einstellungen",
        },
        "icons": {
            "start": "mdi:home-variant-outline",
            "overview": "mdi:solar-power",
            "devices": "mdi:ev-station",
            "priority": "mdi:sort-numeric-ascending",
            "settings": "mdi:palette-swatch-outline",
        },
        "theme_icon": "mdi:white-balance-sunny",
    },
    "natur": {
        "name": "🌿 Natur-frisch",
        "views": {
            "start": "🌱 Start",
            "overview": "🌻 Übersicht",
            "devices": "🔌 Geräte",
            "priority": "⬆️ Reihenfolge",
            "settings": "⚙️ Einstellungen",
        },
        "icons": {
            "start": "mdi:leaf",
            "overview": "mdi:flower-tulip-outline",
            "devices": "mdi:ev-station",
            "priority": "mdi:sort-numeric-ascending",
            "settings": "mdi:tune-variant",
        },
        "theme_icon": "mdi:leaf",
    },
    "klar": {
        "name": "🌊 Kühl & klar",
        "views": {
            "start": "🧭 Start",
            "overview": "🌤 Übersicht",
            "devices": "🔌 Geräte",
            "priority": "⬆️ Reihenfolge",
            "settings": "⚙️ Einstellungen",
        },
        "icons": {
            "start": "mdi:compass-outline",
            "overview": "mdi:weather-sunny",
            "devices": "mdi:ev-station",
            "priority": "mdi:sort-numeric-ascending",
            "settings": "mdi:knob",
        },
        "theme_icon": "mdi:waves",
    },
}

ROLE_ICON = {
    ROLE_WALLBOX: "mdi:ev-station",
    ROLE_WAERMEPUMPE: "mdi:heat-pump",
    "verbraucher": "mdi:power-plug",
}


@dataclass
class DeviceView:
    """Eine Geräte-Sektion für das Dashboard."""

    id: str
    name: str
    role: str
    priority: int  # 1 = höchste
    entities: dict[str, str] = field(default_factory=dict)  # kind -> entity_id
    source: dict[str, str] = field(default_factory=dict)  # soc/temp/power sensor


@dataclass
class DashboardModel:
    """Alle Daten, die das Dashboard benötigt."""

    global_entities: dict[str, str] = field(default_factory=dict)
    energy: dict[str, str] = field(default_factory=dict)  # pv/grid/house -> entity_id
    devices: list[DeviceView] = field(default_factory=list)
    theme: str = DEFAULT_UI_THEME
    setup: str = "start"  # start/messungen/bereit
    options_path: str = ""  # Link auf die PVM-Verwaltung (Entry-Seite)
    suggestions: list[dict] = field(default_factory=list)  # {role, title}


# ---------------------------------------------------------------------------
# Karten-Helfer
# ---------------------------------------------------------------------------
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


def _conditional(entity_id: str, card: dict, state: str = "on") -> dict:
    """Zeigt eine Karte nur, wenn die Gruppen-Entität den Zustand hat."""
    return {
        "type": "conditional",
        "conditions": [{"entity": entity_id, "state": state}],
        "card": card,
    }


def _options_link(path: str, text: str) -> str:
    return f"[{text}]({path})" if path else text


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
def build_dashboard_config(model: DashboardModel) -> dict:
    """Baut die komplette Lovelace-Konfiguration."""
    palette = PALETTES.get(model.theme, PALETTES[DEFAULT_UI_THEME])
    views: list[dict] = []

    # ------------------------------------------------------------------
    # Ansicht 1: Start & Tutorial
    # ------------------------------------------------------------------
    start_cards: list[dict] = []
    setup_sensor = model.global_entities.get("setup")

    # Große Willkommens-/Erste-Schritte-Karte (nur im „start“-Zustand)
    if setup_sensor:
        start_label = SETUP_LABELS[SETUP_START]
        messungen_label = SETUP_LABELS[SETUP_MESSUNGEN]
        welcome = _markdown(
            "## ☀️ Willkommen bei PV Manager!\n"
            "Dieses Dashboard steuert deine Solar-Strom-Verteilung. "
            "In drei Schritten bist du startklar – alles ohne YAML:\n\n"
            "**1️⃣ Sensoren anbinden** – damit PVM weiß, was PV, Netz und Haus liefern.\n"
            f"**2️⃣ Geräte hinzufügen** – Wallbox, Wärmepumpe, Verbraucher.\n"
            "**3️⃣ Genießen** – PVM verteilt den Überschuss nach deinen Zielen.\n\n"
            f"{_options_link(model.options_path, 'Jetzt starten – Messungen & Geräte verwalten ⚙')}"
        )
        start_cards.append(_conditional(setup_sensor, welcome, state=start_label))

    # Aktueller Stand
    status_rows: list[str] = []
    if setup_sensor:
        status_rows.append(setup_sensor)
    if model.global_entities.get("engine_status"):
        status_rows.append(model.global_entities["engine_status"])
    if status_rows:
        start_cards.append(_entities(status_rows, "Dein Stand"))

    # Dauerhaftes Mini-Tutorial (auch später über die Geräte-/Einstellungs-Ansicht)
    tutorial = (
        "## 🧭 So geht's\n"
        "**Sensoren ablesen:** Die Kacheln oben in ☀️ **Übersicht** zeigen live:\n"
        "`PV` = erzeugt gerade, `Netz` = Bezug/Einspeisung, `Haus` = dein Verbrauch, "
        "`Überschuss` = frei verfügbarer Solarstrom. Antippen öffnet den Verlauf.\n\n"
        "**Geräte hinzufügen:** In 🔌 **Geräte** findest du erkannte Geräte und Sensoren. "
        "PVM schlägt sie dir vor – du bestätigst nur noch. "
        f"{_options_link(model.options_path, 'Vorschläge prüfen & übernehmen →')}\n\n"
        "**Dinge einstellen:** Ziele (z. B. „Auto bis 18 Uhr auf 80 %“) und Prioritäten "
        "stellst du direkt auf den Geräte-Karten ein; die Reihenfolge in ⬆️ **Reihenfolge**, "
        "Feintuning (Reserve, Mindestzeiten, Design) in 🎨 **Einstellungen**."
    )
    start_cards.append(_markdown(tutorial))

    # Fehlende Messungen hervorheben (nur im „messungen“-Zustand)
    if setup_sensor:
        hint = (
            "### 🔎 Fast geschafft!\n"
            "Du hast schon Messungen – jetzt fehlen noch Geräte. "
            "Lass PVM suchen und füge dann Wallbox, Wärmepumpe oder Verbraucher hinzu:  "
            f"{_options_link(model.options_path, 'Geräte verwalten →')}"
        )
        start_cards.append(
            _conditional(setup_sensor, _markdown(hint), state=messungen_label)
        )

    views.append(
        {
            "title": palette["views"]["start"],
            "icon": palette["icons"]["start"],
            "cards": start_cards,
        }
    )

    # ------------------------------------------------------------------
    # Ansicht 2: Übersicht (Energie)
    # ------------------------------------------------------------------
    energy_tiles: list[dict] = []
    if model.energy.get("pv"):
        energy_tiles.append(_tile(model.energy["pv"], "mdi:solar-power", "PV-Leistung"))
    if model.energy.get("grid"):
        energy_tiles.append(_tile(model.energy["grid"], "mdi:transmission-tower", "Netz"))
    if model.energy.get("house"):
        energy_tiles.append(_tile(model.energy["house"], "mdi:home", "Hausverbrauch"))
    if model.global_entities.get("surplus"):
        energy_tiles.append(
            _tile(model.global_entities["surplus"], "mdi:solar-power", "Überschuss")
        )

    overview_cards: list[dict] = []
    if energy_tiles:
        overview_cards.append(_grid(energy_tiles))
    else:
        overview_cards.append(
            _markdown(
                "## ☀️ Noch keine Messungen\n"
                "Damit PVM den Überschuss berechnen kann, braucht er mindestens einen "
                "PV- oder Netz-Sensor. "
                f"{_options_link(model.options_path, 'Messungen jetzt hinzufügen →')}"
            )
        )

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
    views.append(
        {
            "title": palette["views"]["overview"],
            "icon": palette["icons"]["overview"],
            "cards": overview_cards,
        }
    )

    # ------------------------------------------------------------------
    # Ansicht 3: Geräte
    # ------------------------------------------------------------------
    device_cards: list[dict] = [
        _markdown(
            "## 🔌 Geräte\n"
            + _options_link(
                model.options_path,
                "＋ Gerät hinzufügen oder bearbeiten",
            )
        )
    ]

    # Gefundene Vorschläge anzeigen (sofern ein Scan etwas Neues fand)
    if model.suggestions:
        lines = ["### ✨ Gefunden – bereit zum Übernehmen", ""]
        for found in model.suggestions:
            role_label = {
                "pv": "PV-Leistung",
                "grid": "Netzbezug/Einspeisung",
                "house": "Hausverbrauch",
                "wallbox": "Wallbox",
                "wp": "Wärmepumpe",
                "verbraucher": "Verbraucher",
            }.get(found.get("role", ""), found.get("role", ""))
            lines.append(f"- **{role_label}:** {found.get('title', '')}")
        lines.append("")
        lines.append(
            _options_link(model.options_path, "Vorschläge prüfen & übernehmen →")
        )
        device_cards.append(_markdown("\n".join(lines)))

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
                        "severity": {
                            "green": 80,
                            "yellow": 60,
                            "red": 0,
                        },
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
                dev.entities[k]
                for k in ("min_soc", "max_soc", "deadline_soc", "deadline_time")
                if dev.entities.get(k)
            ]
            if entity_rows:
                cards.append(_entities(entity_rows, "Ladeziele"))

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
            for kind, icon in (
                ("test_start", "mdi:play",),
                ("test_abort", "mdi:stop",),
            ):
                if dev.entities.get(kind):
                    tiles.append(
                        {"type": "button", "entity": dev.entities[kind], "icon": icon}
                    )
            if dev.entities.get("status"):
                tiles.append(_tile(dev.entities["status"], "mdi:information-outline"))
            if tiles:
                cards.append({"type": "horizontal-stack", "cards": tiles})
            rows = [dev.entities[k] for k in ("comfort", "wp_test_result") if dev.entities.get(k)]
            if rows:
                cards.append(_entities(rows, "Wärmepumpe"))

        else:  # Verbraucher
            tiles = []
            if dev.entities.get("status"):
                tiles.append(_tile(dev.entities["status"], "mdi:information-outline"))
            if tiles:
                cards.append({"type": "horizontal-stack", "cards": tiles})

        device_cards.append(_markdown(f"### {dev.name}"))
        if cards:
            device_cards.append({"type": "vertical-stack", "cards": cards})
        else:
            device_cards.append(_markdown("_Noch keine Werte konfiguriert._"))

    if not model.devices:
        device_cards.append(
            _markdown(
                "_Noch keine Geräte. Nutze die Geräte-Suche im Dashboard "
                "(Button „Geräte suchen“ in den Einstellungen) oder öffne die Verwaltung:_  "
                f"{_options_link(model.options_path, 'Geräte verwalten →')}"
            )
        )
    views.append(
        {
            "title": palette["views"]["devices"],
            "icon": palette["icons"]["devices"],
            "cards": device_cards,
        }
    )

    # ------------------------------------------------------------------
    # Ansicht 4: Reihenfolge (Prioritäten)
    # ------------------------------------------------------------------
    prio_cards: list[dict] = [
        _markdown("## ⬆️ Reihenfolge\n_1 = wird zuerst mit Solarstrom versorgt_")
    ]
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
    if len(prio_cards) == 1:
        prio_cards.append(_markdown("_Noch keine Geräte – danach erscheint die Liste hier._"))
    views.append(
        {
            "title": palette["views"]["priority"],
            "icon": palette["icons"]["priority"],
            "cards": prio_cards,
        }
    )

    # ------------------------------------------------------------------
    # Ansicht 5: Einstellungen (Gruppen mit Aufklapp-Schaltern)
    # ------------------------------------------------------------------
    settings_cards: list[dict] = [
        _markdown(
            "## 🎨 Einstellungen\n"
            "Werte per Schieberegler anpassen – Gruppen bei Bedarf aufklappen."
        )
    ]

    # Design-Umschalter ganz oben
    if model.global_entities.get("theme"):
        settings_cards.append(
            _grid(
                [
                    _tile(
                        model.global_entities["theme"],
                        palette["theme_icon"],
                        "Design",
                    ),
                    _markdown("_Drei Looks: Sonnenaufgang (Standard), Natur-frisch, Kühl & klar._"),
                ],
                columns=1,
            )
        )

    # --- Gruppe: Globale Regeln -----------------------------------------
    global_toggle = model.global_entities.get("group_global")
    if global_toggle:
        global_rows = [
            model.global_entities[k]
            for k in ("mode", "reserve", "cycle", "min_on", "min_off")
            if model.global_entities.get(k)
        ]
        actions: list[dict] = []
        for kind, label in (
            ("scan", "Geräte suchen"),
            ("rebuild", "Dashboard aktualisieren"),
        ):
            if model.global_entities.get(kind):
                actions.append(
                    {"type": "button", "entity": model.global_entities[kind], "name": label}
                )
        if actions:
            actions_card: dict = {"type": "horizontal-stack", "cards": actions}
        else:
            actions_card = _markdown("")
        settings_cards.append(_tile(global_toggle, "mdi:sliders-horizontal", "Globale Regeln"))
        if global_rows:
            settings_cards.append(
                _conditional(
                    global_toggle,
                    {
                        "type": "vertical-stack",
                        "cards": [
                            _entities(global_rows, "Regeln & Zeiten"),
                            actions_card,
                            _markdown(
                                "**Tipp:** Weitere Optionen (WP-Test-Zieltemperatur u. a.) "
                                f"findest du unter {_options_link(model.options_path, 'Verwaltung →')}"
                            ),
                        ],
                    },
                )
            )

    # --- Gruppen je Gerät --------------------------------------------------
    for dev in sorted(model.devices, key=lambda d: d.priority):
        toggle = dev.entities.get("options")
        if not toggle:
            continue
        rows: list[str] = []
        if dev.role == ROLE_WALLBOX:
            rows = [
                dev.entities[k]
                for k in ("auto", "power_charge", "grid_min", "grid_deadline", "power_limit", "min_on_power")
                if dev.entities.get(k)
            ]
            title = "Wallbox-Optionen"
        elif dev.role == ROLE_WAERMEPUMPE:
            rows = [
                dev.entities[k]
                for k in ("auto", "grid_fallback", "comfort", "safety", "test_start", "test_abort", "wp_test_result")
                if dev.entities.get(k)
            ]
            title = "Wärmepumpen-Optionen"
        else:
            rows = [
                dev.entities[k]
                for k in ("auto", "nominal")
                if dev.entities.get(k)
            ]
            title = "Optionen"
        if not rows:
            continue
        settings_cards.append(_tile(toggle, "mdi:chevron-down", dev.name))
        settings_cards.append(
            _conditional(
                toggle,
                _entities(rows, title),
            )
        )

    if len(settings_cards) == 1:
        settings_cards.append(
            _markdown(
                "_Noch keine Geräte – die Gruppen erscheinen, sobald du Geräte hinzufügst._"
            )
        )
    views.append(
        {
            "title": palette["views"]["settings"],
            "icon": palette["icons"]["settings"],
            "cards": settings_cards,
        }
    )

    return {"title": "PV Manager", "views": views}
