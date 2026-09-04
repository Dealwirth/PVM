"""Automatische Geräteerkennung (reine Logik, keine Home-Assistant-Importe).

Die Erkennung bewertet Entitäten anhand von device_class, Einheit, Domain,
deutschen/englischen Namens-Schlüsselwörtern sowie Hersteller-/Integrations-
Signalen und liefert *Vorschläge* mit Begründung. Nichts wird automatisch
konfiguriert – der Nutzer bestätigt (Hybrid-Prinzip: Dashboard/Dialog).

Zusätzlich wird die Zuordnung „welches Auto hängt an welcher Wallbox" über
eine Korrelationsanalyse von Ladeleistung und SoC-Anstieg unterstützt.
"""

from __future__ import annotations

import re

from .const import ROLE_FAHRZEUG

# ---------------------------------------------------------------------------
# Signal-Wörterbücher
# ---------------------------------------------------------------------------
# Schlüsselwörter, die eine Rolle *ausschließen* (Fehlalarme vermeiden)
EXCLUDE_KEYWORDS = {
    "auto_soc": [
        "speicher", "batteriespeicher", "home battery", "powerwall", "usv",
        "batterie haus", "hausbatterie", "akkuspeicher", "heimbatterie",
        "battery system", "ess", "standalone battery", "akkuladezustand haus",
    ],
    "pv": ["netz", "grid", "bezug", "verbrauch", "consumption", "import", "einspeis"],
    "grid": ["pv", "solar", "wechselrichter", "inverter", "produktion"],
    "grid_import": ["pv", "solar", "einspeis", "export"],
    "grid_export": ["pv", "solar", "bezug", "import"],
    "house": ["netz", "grid"],
    "wp": ["puffer", "speicher"],
    "battery": ["auto", "fahrzeug", "vehicle", "car", "soc", "ladezustand", "wallbox"],
}

# Schlüsselwort-Mengen (case-insensitive, Kurzwörter werden mit Wortgrenzen
# gematcht, längere Wörter auch innerhalb zusammengesetzter Namen)
KEYWORDS = {
    "pv": [
        "pv", "photovoltaik", "photovoltaic", "solar", "wechselrichter",
        "inverter", "produktion", "erzeugung", "erzeugt", "yield", "leistung pv",
        "pv leistung", "generation",
    ],
    "grid": [
        "netz", "grid", "bezug", "einspeisung", "einspeis", "feed", "import",
        "export", "zaehler", "zähler", "meter", "netto", "stromzähler",
    ],
    "house": [
        "haus", "house", "home", "household", "gesamt", "verbrauch",
        "consumption", "last", "haushalt",
    ],
    "grid_import": [
        "netzbezug", "netz bezug", "bezug", "strombezug", "grid import",
        "import", "bezug leistung", "bezugsleistung", "netzimport",
    ],
    "grid_export": [
        "netzeinspeisung", "netz einspeisung", "einspeisung", "einspeis",
        "grid export", "export", "netzexport", "einspeiseleistung",
    ],
    "battery": [
        "speicher", "batteriespeicher", "hausbatterie", "heimbatterie",
        "akkuspeicher", "powerwall", "home battery", "battery system",
        "batterie leistung", "speicherleistung", "battery power",
        "storage", "standalone battery", "usv", "ess",
    ],
    "wallbox": [
        "wallbox", "ladestation", "ladepunkt", "charger", "charge point",
        "chargepoint", "evse", "ladebox", "wall box", "chargestation",
        "ladeleistung", "charging", "laden", "charge power", "charging power",
    ],
    "wp": [
        "waermepumpe", "wärmepumpe", "heatpump", "heat pump", "boiler",
        "heizstab", "heizung", "wp", "wärmepumpen", "waermepumpen",
    ],
    "auto_soc": [
        "soc", "state of charge", "ladezustand", "battery level",
        "akkuladezustand",
    ],
    "verbraucher": [
        "waschmaschine", "washing machine", "washer", "trockner", "dryer",
        "lueftung", "lüftung", "ventilation", "poolpumpe", "pool pump",
        "spuelmaschine", "geschirrspueler", "dishwasher", "backofen", "ofen",
        "herd", "staubsaugerroboter",
    ],
    # Steuer-Elemente einer Wallbox/eines Verbrauchers (für die Sets)
    "control_switch": [
        "freigabe", "freigeben", "release", "ein aus", "an aus", "einschalten",
        "ausschalten", "laden starten", "laden stoppen", "charge enable",
        "enable charging", "lock", "sperre",
    ],
    "control_start": [
        "start", "an", "ein", "begin", "resume", "fortsetzen", "weiter",
    ],
    "control_stop": [
        "stop", "stopp", "aus", "pause", "off", "beenden", "abbrechen",
    ],
}

# Hersteller-Signale je Rolle (case-insensitive Teilstring auf Hersteller/Modell)
MANUFACTURERS = {
    "pv": [
        "sma", "growatt", "huawei", "fronius", "kostal", "solaredge", "sungrow",
        "goodwe", "e3dc", "sonnen", "solarwatt", "delta", "alpha ess",
        "enfinity", "solis", "deye", "fox ess",
    ],
    "wallbox": [
        "go-e", "goe", "openwb", "keba", "easee", "zaptec", "alfen", "vestel",
        "wallbe", "mennekes", "chargeamps", "smartfox", "myenergi", "zappi",
        "tinkerforge", "wallbox", "evbox", "elvi", "ewall",
    ],
    "wp": [
        "vaillant", "viessmann", "daikin", "panasonic", "bosch", "stiebel",
        "alpha innotec", "nibe", "weishaupt", "wolf", "dimplex", "thermia",
        "buderus", "junkers", "hitachi", "mitsubishi", "toshiba", "fujitsu",
        "gree", "sauter", "helkama", "lg", "samsung",
    ],
    "auto_soc": [
        "tesla", "volkswagen", "vw", "skoda", "seat", "cupra", "audi", "bmw",
        "mercedes", "renault", "hyundai", "kia", "polestar", "nio", "xiaomi",
        "opel", "peugeot", "citroen", "fiat", "nissan", "ford", "toyota",
        "honda", "mazda", "dacia", "enyaq", "ioniq", "model 3", "model y",
    ],
}

# Typische EV-Modelle → starkes SoC-Signal (auch ohne Markenwort im Entitätsnamen)
EV_MODELS = [
    "enyaq", "id.3", "id.4", "id.5", "model 3", "model y", "model s",
    "model x", "ioniq", "kona", "niro", "leaf", "zoe", "twingo", "corsa-e",
    "e-208", "mg4", "mg zs", "tavascan", "born", "elroq",
]

# device_class, die eine Rolle stark nahelegt
DEVICE_CLASS_HINTS = {
    "pv": {"power"},
    "grid": {"power"},
    "grid_import": {"power"},
    "grid_export": {"power"},
    "house": {"power"},
    "wallbox": {"battery_charging"},
    "wp": {"temperature"},
    "auto_soc": {"battery", "battery_level"},
    "battery": {"battery", "battery_level", "power"},
    "verbraucher": set(),
}

# Diese Rollen brauchen grundsätzlich einen Leistungswert
POWER_ROLES = {"pv", "grid", "grid_import", "grid_export", "house", "wallbox", "battery"}

# Rollen, die (fast) nur als "sensor" vorkommen dürfen
SENSOR_ONLY_ROLES = {"pv", "grid", "grid_import", "grid_export", "house", "wp", "auto_soc", "battery"}

# ---------------------------------------------------------------------------
# Helfer
# ---------------------------------------------------------------------------
_SEP = r"(?:^|[\s_\-:])"
_TAIL = r"(?:$|[\s_\-:])"


def _kw_inside(low_text: str, word: str) -> bool:
    """Schlüsselwort-Match mit Wortgrenzen (Kurzwörter) bzw. Teilstring (≥ 4)."""
    if len(word) >= 4:
        # Erlaubt deutsche Komposita wie "hausverbrauch" oder "ladeleistung"
        return word in low_text
    return re.search(rf"{_SEP}{re.escape(word)}{_TAIL}", low_text) is not None


def _matches(text: str, words: list[str]) -> bool:
    low = text.casefold()
    return any(_kw_inside(low, word.casefold()) for word in words)


def _domain(entity_id: str) -> str:
    return entity_id.split(".", 1)[0] if "." in entity_id else ""


def _is_power_unit(unit: str) -> bool:
    return unit in {"W", "kW", "mW"} or unit.endswith("W")


def _is_percent(unit: str) -> bool:
    return unit == "%" or "prozent" in unit.casefold()


def _text_of(entity: dict) -> str:
    parts = [
        str(entity.get("entity_id", "")),
        str(entity.get("name", "") or entity.get("friendly_name", "")),
        str(entity.get("manufacturer", "") or entity.get("model", "")),
        str(entity.get("integration", "") or entity.get("platform", "")),
    ]
    return " ".join(p for p in parts if p)


def _friendly_name(entity: dict) -> str:
    return str(entity.get("name") or entity.get("friendly_name") or entity.get("entity_id", ""))


def _state_text(entity: dict) -> str:
    value = entity.get("state_value", entity.get("state"))
    if value is None or value == "":
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    unit = str(entity.get("unit_of_measurement", "") or entity.get("unit", ""))
    if unit in {"W", "kW", "mW", "%", "°C"} or unit:
        return f"{number:g} {unit}".strip()
    return f"{number:g}"


# ---------------------------------------------------------------------------
# Bewertung
# ---------------------------------------------------------------------------
class EntityScore:
    """Punktestand einer Entität für eine Rolle mit Begründung."""

    __slots__ = ("role", "score", "reasons")

    def __init__(self, role: str, score: int = 0, reasons: list[str] | None = None):
        self.role = role
        self.score = score
        self.reasons = reasons or []

    def add(self, points: int, reason: str) -> None:
        self.score += points
        self.reasons.append(reason)


def _manufacturer_signals(entity: dict) -> str:
    """Kombinierter, casefolded Hersteller-/Modell-Text."""
    return " ".join(
        str(entity.get(key, "")).casefold()
        for key in ("manufacturer", "model")
    )


def analyse_entity(entity: dict) -> dict[str, EntityScore]:
    """Bewertet eine Entität für alle Rollen; Rolle -> EntityScore."""
    entity_id = str(entity.get("entity_id", ""))
    name = _friendly_name(entity)
    device_class = str(entity.get("device_class", "") or "")
    unit = str(entity.get("unit_of_measurement", "") or entity.get("unit", "") or "")
    domain = _domain(entity_id)
    text = _text_of(entity)
    low_id_name = f"{entity_id} {name}".casefold()
    manufacturer = _manufacturer_signals(entity)

    results: dict[str, EntityScore] = {}

    def get(role: str) -> EntityScore:
        if role not in results:
            results[role] = EntityScore(role)
        return results[role]

    domain_ok = domain in {
        "sensor", "switch", "number", "binary_sensor", "button",
        "select", "input_boolean", "input_number", "input_select",
    }
    if not domain_ok or not entity_id:
        return {}

    # --- Schlüsselwörter ---------------------------------------------------
    for role, words in KEYWORDS.items():
        if role not in ("control_switch", "control_start", "control_stop"):
            if _matches(f"{entity_id} {name}", words):
                matched = next(
                    (w for w in words if _kw_inside(low_id_name, w.casefold())), ""
                )
                get(role).add(40, f"Name/ID enthält „{matched}“")
                if role == "auto_soc":
                    get(role).add(20, "SoC-Signal (Ladezustand)")

    # --- Hersteller-/Modell-/Integrations-Signale ---------------------------
    for role, makers in MANUFACTURERS.items():
        for maker in makers:
            if maker in manufacturer or maker in low_id_name:
                get(role).add(35, f"Hersteller/Modell: „{maker}“")
                break
    for model in EV_MODELS:
        if model in low_id_name:
            get("auto_soc").add(45, f"Bekanntes E-Auto-Modell: „{model}“")
            break

    # --- device_class -------------------------------------------------------
    for role, classes in DEVICE_CLASS_HINTS.items():
        if device_class in classes:
            get(role).add(25, f"device_class „{device_class}“")

    # --- Einheiten & Domain ------------------------------------------------
    is_power = _is_power_unit(unit)
    is_percent = _is_percent(unit)
    if is_power:
        for role in POWER_ROLES:
            if role in results:
                results[role].add(10, f"Einheit „{unit}“")
    if is_percent and "auto_soc" in results:
        results["auto_soc"].add(15, f"Einheit „{unit}“")
    if domain not in {"sensor", "number", "input_number"}:
        # Leistungs-/Messgrößen kommen praktisch immer als sensor/number
        for role in SENSOR_ONLY_ROLES:
            if role in results:
                results[role].add(-40, "kein Mess-Sensor")

    # --- Namens-Zusatzsignale ----------------------------------------------
    if _matches(text, ["auto", "fahrzeug", "vehicle", "e-auto", "elektroauto", "ev"]):
        if device_class in DEVICE_CLASS_HINTS["auto_soc"] or _matches(
            text, KEYWORDS["auto_soc"]
        ):
            get("auto_soc").add(20, "Name deutet auf Fahrzeug")

    # --- Ausschlüsse ---------------------------------------------------------
    for role, words in EXCLUDE_KEYWORDS.items():
        if role in results and _matches(f"{entity_id} {name}", words):
            results[role].add(-80, f"Ausschluss: „{words[0]}“")

    # Verbraucher: nur bei klaren Gerätenamen
    if "verbraucher" in results and domain not in {"switch", "input_boolean"}:
        results["verbraucher"].add(-10, "kein Schalter")

    return {role: score for role, score in results.items() if score.score > 0}


def score_entity(entity: dict) -> dict[str, int]:
    """Kompatibilitäts-Wrapper: Rolle -> Punkte."""
    return {role: score.score for role, score in analyse_entity(entity).items()}


def candidates_for_role(
    entities: list[dict], role: str, top_n: int = 5
) -> list[dict]:
    """Beste Kandidaten (mit Begründung, Name, Einheit) für eine Rolle."""
    scored = []
    for entity in entities:
        analysis = analyse_entity(entity)
        hit = analysis.get(role)
        if hit is None:
            continue
        scored.append(
            {
                "entity_id": str(entity.get("entity_id", "")),
                "name": _friendly_name(entity),
                "role": role,
                "score": hit.score,
                "reasons": hit.reasons,
                "unit": str(
                    entity.get("unit_of_measurement", "")
                    or entity.get("unit", "")
                    or ""
                ),
                "state": _state_text(entity),
            }
        )
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:top_n]


def best_for_role(entities: list[dict], role: str, min_score: int = 45) -> list[str]:
    """Beste Kandidaten (entity_ids) für eine Rolle, absteigend nach Punkten."""
    return [
        candidate["entity_id"] for candidate in candidates_for_role(entities, role)
        if candidate["score"] >= min_score
    ]


def suggest_energy(entities: list[dict]) -> dict[str, str | None]:
    """Schlägt je einen Sensor für PV, Netz (kombiniert), getrennten
    Netzbezug/Einspeisung und Hausverbrauch vor."""
    suggestions = {
        "pv": best_for_role(entities, "pv"),
        "grid": best_for_role(entities, "grid"),
        "grid_import": best_for_role(entities, "grid_import"),
        "grid_export": best_for_role(entities, "grid_export"),
        "house": best_for_role(entities, "house"),
    }
    return {key: (ids[0] if ids else None) for key, ids in suggestions.items()}


def suggest_devices(entities: list[dict]) -> dict[str, list[str]]:
    """Schlägt Geräte-Kandidaten vor (wallbox, wp_temp, auto_soc)."""
    return {
        "wallbox": best_for_role(entities, "wallbox"),
        "wp_temp": best_for_role(entities, "wp"),
        "auto_soc": best_for_role(entities, "auto_soc"),
    }


# ---------------------------------------------------------------------------
# Kandidaten-Sets (für den „Gefunden – übernehmen“-Dialog)
# ---------------------------------------------------------------------------
_CONTROL_DOMAINS = {"switch", "input_boolean", "button"}


def _control_entity(entities: list[dict], keywords: list[str]) -> str | None:
    """Bester Schalter/Taster aus einer Entitätenliste zu Schlüsselwörtern."""
    best: tuple[int, str] | None = None
    for entity in entities:
        domain = _domain(str(entity.get("entity_id", "")))
        if domain not in _CONTROL_DOMAINS:
            continue
        name = _friendly_name(entity)
        if not _matches(f"{entity.get('entity_id')} {name}", keywords):
            continue
        score = len(name)
        if best is None or score > best[0]:
            best = (score, str(entity.get("entity_id", "")))
    return best[1] if best else None


def _best_of(entities: list[dict], role: str) -> dict | None:
    candidates = candidates_for_role(entities, role, top_n=1)
    return candidates[0] if candidates else None


def suggest_sets(entities: list[dict]) -> list[dict]:
    """Gruppierte Vorschläge für die Übernahme im Dashboard/Dialog.

    Liefert eine Liste von Dicts:
      {role, title, score, reasons, fields, source}
    - role: "pv"/"grid"/"house" (Messung) oder "wallbox"/"wp"/"verbraucher"
    - fields: passende Entitäten (entity_id -> Kandidat oder None)
    - source: {"power": .., "soc": .., "temp": ..} für das Dashboard-Modell
    """
    sets: list[dict] = []

    # 1) Energie-Messungen (Top-1 je Rolle mit Begründung)
    for role in ("pv", "grid", "grid_import", "grid_export", "house"):
        candidate = _best_of(entities, role)
        if candidate is None:
            continue
        sets.append(
            {
                "role": role,
                "title": candidate["name"],
                "score": candidate["score"],
                "reasons": candidate["reasons"],
                "fields": {"entity": candidate["entity_id"]},
                "source": {role: candidate["entity_id"]},
            }
        )

    # 2) Geräte: Entitäten nach device_id gruppieren (echte Geräte)
    by_device: dict[str, list[dict]] = {}
    singles: list[dict] = []
    for entity in entities:
        device_id = entity.get("device_id")
        (by_device.setdefault(str(device_id), []) if device_id else singles).append(entity)

    clusters: list[list[dict]] = list(by_device.values())
    for single in singles:
        # Nur Einzel-Sensoren ohne Gerätezuordnung, die klar Wallbox/WP/Auto sind
        analysis = analyse_entity(single)
        if "wallbox" in analysis or "wp" in analysis or "auto_soc" in analysis:
            clusters.append([single])

    seen: set[str] = set()

    def add_car_set(cluster: list[dict]) -> None:
        """Vorschlag für ein reines E-Auto (Überwachung, keine Wallbox)."""
        soc = _best_of(cluster, "auto_soc")
        if soc is None:
            return
        power = _best_of(cluster, "wallbox") or _best_of(cluster, "battery")
        title = _cluster_title(cluster, fallback="Auto")
        key = f"fahrzeug:{title}"
        if key in seen:
            return
        seen.add(key)
        sets.append(
            {
                "role": "fahrzeug",
                "title": title,
                "score": soc["score"],
                "reasons": soc["reasons"] + ["E-Auto erkannt (SoC)"],
                "fields": {
                    "soc_sensor": soc["entity_id"],
                    "power_sensor": power["entity_id"] if power else None,
                },
                "control": None,
                "source": {
                    "soc": soc["entity_id"],
                    "power": power["entity_id"] if power else None,
                },
            }
        )

    def add_device_set(cluster: list[dict], role: str) -> None:
        nonlocal seen
        power = _best_of(cluster, "wallbox" if role == "wallbox" else "wp")
        soc = _best_of(cluster, "auto_soc")
        # Temperatur ist ein reines sensor-Signal
        temp = _best_of([e for e in cluster if _domain(str(e.get("entity_id", ""))) == "sensor"], "wp")

        if role == "wallbox":
            # Steuer-Elemente in derselben Gerätegruppe suchen
            start = _control_entity(cluster, KEYWORDS["control_start"])
            stop = _control_entity(cluster, KEYWORDS["control_stop"])
            single_switch = _control_entity(cluster, KEYWORDS["control_switch"])
            if start is None and stop is None and single_switch is None:
                single_switch = _control_entity(
                    cluster, ["charge", "lad", "lade", "freigabe"]
                )
            number_entity = None
            for entity in cluster:
                domain = _domain(str(entity.get("entity_id", "")))
                unit = str(entity.get("unit_of_measurement", "") or "")
                if domain in {"number", "input_number"} and unit in {"A", "mA", "kW", "W"}:
                    number_entity = str(entity.get("entity_id", ""))
                    break

            fields: dict[str, str | None] = {
                "switch_entity": single_switch,
                "on_entity": start,
                "off_entity": stop,
                "number_entity": number_entity,
                "power_sensor": power["entity_id"] if power else None,
                "soc_sensor": soc["entity_id"] if soc else None,
            }
            control = "buttons" if (start and stop) else "switch"
            reasons = ["Gerät erkannt als Wallbox/Ladestation"]
            if power:
                reasons.extend(power["reasons"])
            title = _cluster_title(cluster, fallback="Wallbox")
            key = f"{role}:{title}"
            if key in seen:
                return
            seen.add(key)
            sets.append(
                {
                    "role": role,
                    "title": title,
                    "score": (power["score"] if power else 40),
                    "reasons": reasons,
                    "fields": fields,
                    "control": control,
                    "source": {
                        "power": power["entity_id"] if power else None,
                        "soc": soc["entity_id"] if soc else None,
                    },
                }
            )
        elif role == "wp":
            temp_id = temp["entity_id"] if temp else None
            if temp_id is None:
                return
            key = f"wp:{_cluster_title(cluster, fallback='Wärmepumpe')}"
            if key in seen:
                return
            seen.add(key)
            # Ein-/Ausschalter suchen …
            control = _control_entity(cluster, KEYWORDS["control_switch"]) or _control_entity(
                cluster, ["heiz", "freigabe", "betrieb"]
            )
            # … oder eine einstellbare Ziel-Temperatur (number mit °C): Viele
            # Wärmepumpen lassen sich nicht schalten, nur die gewünschte
            # Speichertemperatur einstellen (Steuerungsart „wp_temp“).
            temp_entity = None
            if control is None:
                for entity in cluster:
                    domain = _domain(str(entity.get("entity_id", "")))
                    unit = str(entity.get("unit_of_measurement", "") or "")
                    if domain in {"number", "input_number"} and "°C" in unit:
                        temp_entity = str(entity.get("entity_id", ""))
                        break
            fields = {
                "switch_entity": control,
                "on_entity": None,
                "off_entity": None,
                "number_entity": None,
                "temp_entity": temp_entity,
                "power_sensor": power["entity_id"] if power else None,
                "temp_sensor": temp_id,
                "soc_sensor": None,
            }
            reasons = temp["reasons"] if temp else ["Wärmepumpen-Temperatur erkannt"]
            if temp_entity:
                reasons.append("Ziel-Temperatur einstellbar (kein Schalter nötig)")
            sets.append(
                {
                    "role": role,
                    "title": _cluster_title(cluster, fallback="Wärmepumpe"),
                    "score": (temp["score"] if temp else 40),
                    "reasons": reasons,
                    "fields": fields,
                    "control": "wp_temp" if temp_entity else "switch",
                    "source": {
                        "temp": temp_id,
                        "power": power["entity_id"] if power else None,
                    },
                }
            )

    for cluster in clusters:
        if len(cluster) < 1:
            continue
        text = " ".join(_text_of(e) for e in cluster).casefold()
        is_wallbox = any(
            m in text for m in ("wallbox", "ladestation", "charger", "chargepoint", "evse")
        ) or any(
            m in _manufacturer_signals(e)
            for e in cluster
            for m in MANUFACTURERS["wallbox"]
        )
        is_wp = any(
            m in text for m in ("waermepumpe", "heatpump", "heat pump", "wärmepumpe")
        ) or any(
            m in _manufacturer_signals(e) for e in cluster for m in MANUFACTURERS["wp"]
        )
        is_car = (
            not is_wallbox
            and not is_wp
            and any(m in text for m in ("auto", "fahrzeug", "vehicle", "car", "ev "))
            and any(m in text for m in ("soc", "batterie", "battery", "ladezustand"))
        ) or any(
            m in _manufacturer_signals(e)
            for e in cluster
            for m in MANUFACTURERS["auto_soc"]
        )
        if is_wallbox:
            add_device_set(cluster, "wallbox")
        elif is_wp:
            add_device_set(cluster, "wp")
        elif is_car:
            add_car_set(cluster)

    sets.sort(key=lambda item: item["score"], reverse=True)
    return sets


def _cluster_title(cluster: list[dict], fallback: str) -> str:
    """Verständlicher Titel eines Geräte-Clusters."""
    for entity in cluster:
        manufacturer = str(entity.get("manufacturer", "")).strip()
        model = str(entity.get("model", "")).strip()
        name = str(entity.get("device_name", "") or "").strip()
        if name:
            return name
        if manufacturer and model:
            return f"{manufacturer} {model}"
    return fallback


# ---------------------------------------------------------------------------
# Korrelation Wallbox ↔ Auto (SoC-Anstieg ↔ Ladeleistung)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Automatische Zuordnung: welches Auto hängt an welcher Wallbox?
# ---------------------------------------------------------------------------
def assign_cars_to_wallboxes(
    cars: list[dict],
    wallboxes: list[dict],
    min_charge_w: float = 60.0,
    tolerance: float = 0.12,
) -> dict[str, str]:
    """Ordnet Autos Wallboxen zu (car_id -> wallbox_id), rein über Leistung.

    ``cars`` und ``wallboxes`` sind Listen von Dicts mit ``id`` und
    ``power_w`` (aktueller Messwert in Watt oder None). Es zählen nur Werte
    über ``min_charge_w`` (Gerät lädt gerade).

    Strategie (vollautomatisch):
    - Lädt nur ein Auto, wird es der einzigen aktiven Wallbox zugeordnet
      (trivial – solange die Leistung plausibel zusammengehört).
    - Mehrere Autos/Wallboxen: absteigend nach Leistung sortieren und Autos
      greedy der Wallbox mit dem ähnlichsten Wert zuordnen (Toleranz =
      max(150 W, 12 % des höheren Werts)). So bleiben verschiedene
      Ladeleistungen unterscheidbar.
    """
    charging_wb = [
        w
        for w in wallboxes
        if w.get("power_w") is not None and w["power_w"] >= min_charge_w
    ]
    charging_cars = [
        c
        for c in cars
        if c.get("power_w") is not None and c["power_w"] >= min_charge_w
    ]
    assignments: dict[str, str] = {}
    if not charging_cars or not charging_wb:
        return assignments

    wb_sorted = sorted(charging_wb, key=lambda w: w["power_w"], reverse=True)
    car_sorted = sorted(charging_cars, key=lambda c: c["power_w"], reverse=True)
    used_wb: set[str] = set()
    for car in car_sorted:
        best: dict | None = None
        best_diff: float | None = None
        for wb in wb_sorted:
            if wb["id"] in used_wb:
                continue
            diff = abs(wb["power_w"] - car["power_w"])
            tol = max(150.0, tolerance * max(wb["power_w"], car["power_w"]))
            if diff <= tol and (best_diff is None or diff < best_diff):
                best = wb
                best_diff = diff
        if best is not None:
            assignments[car["id"]] = best["id"]
            used_wb.add(best["id"])
    return assignments


def pair_by_plug_time(
    wallbox_events: list[dict],
    car_events: list[dict],
    max_delta_s: float = 150.0,
) -> dict[str, str]:
    """Ordnet Autos Wallboxen über den Einsteck-Zeitpunkt zu.

    ``wallbox_events`` / ``car_events``: Listen von Dicts mit ``id`` und
    ``plug_ts`` (Zeitpunkt, an dem das Laden begonnen hat – also der Moment,
    in dem das Auto angesteckt wurde). Liefert ``{wallbox_id: car_id}``.

    Idee: Steckt ein Auto um 12:33 an Wallbox A und ein anderes Auto genau
    dann an Wallbox B, gehören sie zusammen – die Einsteck-Zeitpunkte sind
    ein starkes, unabhängiges Signal. Es wird gierig die zeitlich
    ähnlichste Kombination gebildet; nur Paare innerhalb von
    ``max_delta_s`` werden übernommen (jede Wallbox/ jedes Auto nur einmal).
    """
    if not wallbox_events or not car_events:
        return {}
    wb_sorted = sorted(wallbox_events, key=lambda e: e.get("plug_ts", 0.0))
    car_sorted = sorted(car_events, key=lambda e: e.get("plug_ts", 0.0))
    used_cars: set[str] = set()
    pairs: dict[str, str] = {}
    for wb in wb_sorted:
        best: tuple[float, str] | None = None
        for car in car_sorted:
            car_id = str(car.get("id"))
            if car_id in used_cars:
                continue
            delta = abs(float(wb.get("plug_ts", 0.0)) - float(car.get("plug_ts", 0.0)))
            if delta <= max_delta_s and (best is None or delta < best[0]):
                best = (delta, car_id)
        if best is not None:
            pairs[str(wb.get("id"))] = best[1]
            used_cars.add(best[1])
    return pairs


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

    for i in range(len(power_sorted)):
        t0 = power_sorted[i][0]
        window_power = [
            p for ts, p in power_sorted if t0 - window_s <= ts <= t0 + window_s
        ]
        if not window_power:
            continue
        avg_power = sum(window_power) / len(window_power)
        if avg_power < min_power_w:
            continue
        soc_window = [s for ts, s in soc_sorted if t0 - window_s <= ts <= t0 + window_s]
        if len(soc_window) < 2:
            continue
        if max(soc_window) - min(soc_window) >= min_soc_rise_pct:
            return True
    return False


def car_for_wallbox(
    config: dict,
    wallbox_id: str,
    assignments: dict[str, str] | None = None,
    wallbox_charging: bool = False,
) -> dict | None:
    """Findet das Auto, das an einer Wallbox hängt bzw. dort zu Hause ist.

    Reine Logik auf der Konfiguration – liefert das Geräte-Dict des Autos
    oder None. Reihenfolge:

    1. **Live-Zuordnung** (Einsteck-Zeitpunkt / Leistungsvergleich):
       ``assignments`` ist ``{car_id: wallbox_id}`` aus der laufenden
       Erkennung – dieses Auto ist sicher an der Wallbox.
    2. **Gelernte Heimat-Wallbox** (``car.home_wallbox``), solange die
       Wallbox gerade lädt (``wallbox_charging=True``) – dann ist das Auto
       dort so gut wie sicher angesteckt.

    Damit gelten für eine Wallbox immer die Ziele des **Autos** (SoC-Grenzen,
    Zeit-Ziele, Power Charge) und nicht die der Wallbox – Auto und Wallbox
    sind in der Bedienung getrennt, koppeln sich aber automatisch.
    """
    cars = [
        d
        for d in (config.get("devices") or [])
        if d.get("role") == ROLE_FAHRZEUG
    ]
    if not cars:
        return None
    if assignments:
        for car in cars:
            if assignments.get(car.get("id")) == wallbox_id:
                return car
    if wallbox_charging:
        for car in cars:
            home = (car.get("car") or {}).get("home_wallbox")
            if home == wallbox_id:
                return car
    return None
