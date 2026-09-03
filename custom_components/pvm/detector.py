"""Automatische Geräteerkennung (reine Logik, keine Home-Assistant-Importe).

Die Erkennung bewertet Entitäten anhand von device_class, Einheit und
deutschen/englischen Namens-Schlüsselwörtern und liefert *Vorschläge*.
Nichts wird automatisch konfiguriert – der Nutzer bestätigt im Wizard.

Zusätzlich wird die Zuordnung „welches Auto hängt an welcher Wallbox" über
eine Korrelationsanalyse von Ladeleistung und SoC-Anstieg unterstützt.
"""

from __future__ import annotations

# Schlüsselwörter, die eine Rolle *ausschließen* (Fehlalarme vermeiden)
EXCLUDE_KEYWORDS = {
    "auto_soc": [
        "speicher", "batteriespeicher", "home battery", "powerwall",
        "usv", "batterie haus", "hausbatterie", "akkuspeicher",
    ],
    "pv": ["netz", "grid"],
    "grid": ["pv", "solar"],
}

# Schlüsselwort-Mengen (case-insensitive)
KEYWORDS = {
    "pv": [
        "pv", "photovoltaik", "photovoltaic", "solar", "wechselrichter",
        "inverter", "produktion", "produktion_pv", "erzeugung",
    ],
    "grid": [
        "netz", "grid", "bezug", "einspeisung", "einspeis", "feed",
        "import", "export", "zaehler", "zähler", "meter", "netto",
    ],
    "house": [
        "haus", "house", "home", "household", "gesamt", "verbrauch",
        "consumption", "last",
    ],
    "wallbox": [
        "wallbox", "ladestation", "ladepunkt", "charger", "charge point",
        "chargepoint", "evse", "ladebox", "wall box", "chargestation",
        "ladeleistung", "charging", "laden",
    ],
    "waermepumpe": [
        "waermepumpe", "wärmepumpe", "heatpump", "heat pump", "wp", "boiler",
        "heizstab", "heizung",
    ],
    "auto_soc": [
        "soc", "state of charge", "ladezustand", "battery level", "akkuladezustand",
    ],
    "verbraucher": [
        "waschmaschine", "washing machine", "washer", "trockner", "dryer",
        "lueftung", "lüftung", "ventilation", "poolpumpe", "pool pump",
        "spuelmaschine", "geschirrspueler", "dishwasher",
    ],
}

# Keyword-Treffer wiegen für bestimmte Rollen schwerer (z. B. SoC wird
# sonst zu selten erkannt)
KEYWORD_BONUS = {"auto_soc": 60}

# device_class, die eine Rolle stark nahelegt
DEVICE_CLASS_HINTS = {
    "pv": {"power"},
    "grid": {"power"},
    "house": {"power"},
    "wallbox": {"battery_charging"},
    "waermepumpe": {"temperature"},
    "auto_soc": {"battery", "battery_level"},
    "verbraucher": set(),
}

# Diese Rollen brauchen grundsätzlich einen Leistungswert
POWER_ROLES = {"pv", "grid", "house", "wallbox"}


def _matches(text: str, words: list[str]) -> bool:
    """Prüft, ob eines der Schlüsselwörter als Wort im Text vorkommt."""
    low = text.casefold()
    for word in words:
        w = word.casefold()
        if w in low:
            # Wortgrenzen grob prüfen, um z. B. "wallbox" in "wallbox2" zu finden,
            # aber nicht "pv" in "pv-anlage" zu verlieren – hier reicht Substring.
            return True
    return False


def score_entity(entity: dict) -> dict[str, int]:
    """Bewertet eine Entität für alle Rollen; liefert Rolle -> Punkte."""
    entity_id = str(entity.get("entity_id", ""))
    name = str(entity.get("name", "") or entity.get("friendly_name", ""))
    device_class = str(entity.get("device_class", "") or "")
    unit = str(entity.get("unit_of_measurement", "") or entity.get("unit", "") or "")
    domain = entity_id.split(".", 1)[0] if "." in entity_id else ""

    domain_ok = domain in {"sensor", "switch", "number", "binary_sensor"}
    if not domain_ok:
        return {}

    scores: dict[str, int] = {}
    text = f"{entity_id} {name}"

    def add(role: str, base: int) -> None:
        scores[role] = scores.get(role, 0) + base

    for role, words in KEYWORDS.items():
        if _matches(text, words):
            add(role, KEYWORD_BONUS.get(role, 40))

    # device_class-Hinweise
    for role, classes in DEVICE_CLASS_HINTS.items():
        if device_class in classes:
            add(role, 25)

    # Leistungseinheit (W/kW) stärkt bereits erkannte Leistungsrollen
    is_power_unit = unit in {"W", "kW", "mW"} or unit.endswith("W")
    if is_power_unit:
        for role in POWER_ROLES:
            if role in scores:
                scores[role] += 8

    # Name enthält "auto"/"fahrzeug" + battery => auto_soc
    if _matches(
        text, ["auto", "fahrzeug", "vehicle", "tesla", "id.", "enyaq", "ioniq"]
    ):
        if device_class in DEVICE_CLASS_HINTS["auto_soc"] or _matches(
            text, KEYWORDS["auto_soc"]
        ):
            add("auto_soc", 20)

    # Ausschlüsse (z. B. Hausbatterie-Speicher sind keine Auto-SoC-Sensoren)
    for role, words in EXCLUDE_KEYWORDS.items():
        if role in scores and _matches(text, words):
            scores[role] -= 60

    # Verbraucher: nur bei klaren Gerätenamen + Schaltbarkeit
    if scores.get("verbraucher"):
        if domain != "switch":
            add("verbraucher", -10)

    # Ausschluss: "wp" allein ist zu vage (z. B. Wechselrichter-WP?)
    return {role: score for role, score in scores.items() if score > 0}


def best_for_role(entities: list[dict], role: str, min_score: int = 45) -> list[str]:
    """Beste Kandidaten (entity_ids) für eine Rolle, absteigend nach Punkten."""
    ranked = []
    for entity in entities:
        scores = score_entity(entity)
        score = scores.get(role, 0)
        if score >= min_score:
            ranked.append((score, str(entity.get("entity_id", ""))))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [entity_id for _, entity_id in ranked]


def suggest_energy(entities: list[dict]) -> dict[str, str | None]:
    """Schlägt je einen Sensor für PV, Netz und Hausverbrauch vor."""
    return {
        "pv": best_for_role(entities, "pv")[0] if best_for_role(entities, "pv") else None,
        "grid": best_for_role(entities, "grid")[0] if best_for_role(entities, "grid") else None,
        "house": best_for_role(entities, "house")[0] if best_for_role(entities, "house") else None,
    }


def suggest_devices(entities: list[dict]) -> dict[str, list[str]]:
    """Schlägt Geräte-Kandidaten vor (wallbox, wp_temp, auto_soc)."""
    return {
        "wallbox": best_for_role(entities, "wallbox", min_score=45),
        "wp_temp": best_for_role(entities, "waermepumpe", min_score=45),
        "auto_soc": best_for_role(entities, "auto_soc", min_score=45),
    }


def match_power_soc(
    power_series: list[tuple[float, float]],
    soc_series: list[tuple[float, float]],
    window_s: float = 180.0,
    min_power_w: float = 300.0,
    min_soc_rise_pct: float = 0.5,
) -> bool:
    """Korrelations-Check: Lädt die Wallbox (Leistung), während der SoC steigt?

    Liefert True, wenn es mindestens ein Zeitfenster gibt, in dem die
    Ladeleistung über der Schwelle liegt und der SoC im selben Fenster
    deutlich steigt. Eingaben sind (ts, wert)-Listen.
    """
    if len(power_series) < 2 or len(soc_series) < 2:
        return False

    power_sorted = sorted(power_series)
    soc_sorted = sorted(soc_series)

    # Zeitfenster über die Power-Serie schieben
    for i in range(len(power_sorted)):
        t0 = power_sorted[i][0]
        t1 = t0 + window_s
        window_power = [
            p for ts, p in power_sorted if t0 - window_s <= ts <= t1
        ]
        if not window_power:
            continue
        avg_power = sum(window_power) / len(window_power)
        if avg_power < min_power_w:
            continue
        # SoC im selben Fenster: Differenz zwischen min und max
        soc_window = [s for ts, s in soc_sorted if t0 - window_s <= ts <= t1]
        if len(soc_window) < 2:
            continue
        if max(soc_window) - min(soc_window) >= min_soc_rise_pct:
            return True
    return False
