# 🏗️ Architektur & Struktur

> 📖 **PV Manager – Dokumentation** · [⬅️ Zurück zum README](../README.md) · [Entwicklung](development.md)

Dieses Dokument beschreibt den vollständigen Aufbau des PVM-Projekts – vom Repository-Wurzelverzeichnis bis zur letzten Datei. Es richtet sich an Entwickler und alle, die verstehen möchten, wie PVM intern funktioniert.

---

## 📁 Projektstruktur (komplett)

```
PVM/
├── README.md                          Hauptdokumentation (Start hier)
├── CHANGELOG.md                       Versionshistorie
├── LICENSE                            MIT-Lizenz
├── hacs.json                          HACS-Metadaten (Name, Domain, Version)
├── pyproject.toml                     Projekt-Metadaten für pytest/ruff
├── ruff.toml                          Lint-Konfiguration (ruff)
├── requirements-test.txt              Test-Abhängigkeiten (pytest, ruff)
├── .gitattributes                     Zeilenenden für Git
├── .gitignore                         Ignorierte Dateien
├── .github/
│   └── workflows/
│       ├── validate.yml               CI: ruff + pytest + hassfest (bei jedem Push/PR)
│       └── release.yml                Release-Workflow (Tag → HACS-kompatibles ZIP)
├── custom_components/
│   └── pvm/                           Die Integration (HACS-Domain: pvm)
│       ├── __init__.py                Einstiegspunkt, Plattform-Setup, Panel + WebSocket
│       ├── manifest.json              Manifest (Domain, Version, Anforderungen)
│       ├── const.py                   Konstanten, Standardwerte, Beschriftungen
│       ├── config_model.py            Geräte- und Integrations-Datenmodell (pure Logik)
│       ├── config_flow.py             Ein-Klick-Installation (keine Fragen, kein Options-Flow)
│       ├── store.py                   JSON-Persistenz (speichert alle Einstellungen)
│       ├── manager.py                 Herzstück: Steuerzyklus, Service-Aufrufe, WP-Test, Scan
│       ├── engine.py                  Prioritäts-Engine (reine Logik, keine HA-Importe)
│       ├── detector.py                Automatische Geräteerkennung (pure Logik)
│       ├── wp_test.py                 WP-Kalibrierung als Zustandsmaschine (pure Logik)
│       ├── panel.py                   Seitenleisten-Panel registrieren, alte Dashboards entfernen
│       ├── panel_data.py              Entitäten-Mapping + Datenpaket für die Seite (testbar)
│       ├── websocket.py               WebSocket-Kommandos (get_config/save_config/scan/list)
│       ├── panel/
│       │   └── panel.js               Komplett eigene Oberfläche (HTML/CSS/JS, ~1.900 Zeilen)
│       ├── sensor.py                  Sensor-Plattform (PVM-Status, Geräte-Sensoren)
│       ├── number.py                  Zahlen-Plattform (SOC-Ziele, Leistungs-Limits)
│       ├── switch.py                  Schalter-Plattform (Automatik, Power Charge, Netz-Freigaben)
│       ├── button.py                  Button-Plattform (Scan, Seite neu registrieren, WP-Test)
│       ├── select.py                  Auswahl-Plattform (Betriebsmodus, Design)
│       ├── time.py                    Zeit-Plattform (Frist-Ziele)
│       ├── services.py                Service-Handler (9 Services)
│       ├── services.yaml              Service-Definitionen (deutsch, für HA-UI)
│       ├── diagnostics.py             Diagnose-Export für HA
│       └── translations/
│           ├── de.json                Deutsche Übersetzungen (Primärsprache)
│           └── en.json                Englische Übersetzungen (Fallback)
├── docs/
│   ├── installation.md                Installation & Inbetriebnahme
│   ├── configuration.md               Konfiguration im Detail
│   ├── development.md                 Entwicklerhandbuch
│   ├── architecture.md                Dieses Dokument
│   └── faq.md                         Häufige Fragen & Fehlerbehebung
└── tests/
    ├── conftest.py                    HA-Stubs für reine Logik-Tests + Import-Smoke-Test
    ├── test_config_model.py           Datenmodell-Tests
    ├── test_detector.py               Erkennungs-Tests
    ├── test_engine.py                 Engine-Tests (Prioritäten, Ziele, Hysterese)
    ├── test_wp_test.py                WP-Test-Tests
    ├── test_panel_data.py             Entitäten-Mapping/Payload-Tests
    └── test_imports.py                Import-Smoke-Tests (alle Module laden ohne HA)
```

---

## 🧠 Architektur im Überblick

PVM folgt einem **dreischichtigen Design**:

| Schicht | Dateien | Aufgabe |
| :--- | :--- | :--- |
| **Pure Logik** | `engine.py`, `wp_test.py`, `detector.py`, `config_model.py`, `panel_data.py` (Kern) | Reines Python ohne Home-Assistant-Importe → vollständig unit-testbar, läuft überall |
| **HA-Anbindung** | `manager.py`, `config_flow.py`, alle Plattformen, `store.py`, `websocket.py`, `panel.py` | Übersetzt Home Assistant in die pure Logik und zurück; stellt der Seite die Daten bereit |
| **Eigene Oberfläche** | `panel/panel.js` | Komplett selbst gebaute Seite im Browser – kein Lovelace, keine YAML, keine HA-Dialoge |

Vorteil: Die kritischen Entscheidungen (wer bekommt wann wie viel Strom) sind **ohne HA-Installation testbar** – das ist der Grund, warum PVM so ausfallsicher ist. Die Oberfläche ist eine eigene HTML/JS/CSS-Seite, die nur über WebSocket-Kommandos mit HA spricht; bricht HA-UI umgebaut wird, bleibt PVM unberührt.

---

## 📦 Die Module im Detail

### Einstieg & Konfiguration

| Datei | Beschreibung |
| :--- | :--- |
| `__init__.py` | Einstiegspunkt der Integration: lädt Konfiguration, startet den Manager, registriert Plattformen, Services, WebSocket-Kommandos und das Seitenleisten-Panel. |
| `manifest.json` | HACS-/HA-Manifest: `domain: pvm`, Version, Anforderungen (2025.2+). |
| `const.py` | Alle Konstanten: Standardwerte (Mindest-Ladeleistung 1,4 kW, Reserve, Zyklus 30 s), Geräte-Rollen, Designs, Entitäts-Kataloge, Übersetzungs-Schlüssel. |
| `config_model.py` | Datenmodell: normalisiert gespeicherte Geräte, liefert Standardwerte, validiert. Reine Logik. |
| `config_flow.py` | **Kein Wizard, keine Fragen:** Eintrag entsteht in einem Klick (`async_create_entry`). Es gibt bewusst keinen Options-Flow mehr – alles verwaltet die eigene Seite. |
| `store.py` | JSON-Persistenz im HA-Store (`.storage/pvm`). Jede Änderung wird sofort gespeichert. |

### Steuerung (Herzstück)

| Datei | Beschreibung |
| :--- | :--- |
| `manager.py` | **Der Steuerzyklus**: alle 30 Sekunden Energie lesen → Engine aufrufen → Befehle ausführen. Verwaltet außerdem WP-Test, Geräte-Scan, Frist-Ziele, Fehler-Backoff (3 Fehler → Pause → Neustart), die letzten gültigen Messwerte sowie `async_replace_config` (Speichern aus dem Panel). |
| `engine.py` | **Die Prioritäts-Engine** (pure Logik): verteilt Überschuss nach Prioritätsliste, beachtet Mindest-Ladeleistung, Leistungs-Limits, Hysterese, Mindest-Ein-/Ausschaltzeiten, Frist-Ziele, Mindest-/Max-SOC und Power Charge. |
| `wp_test.py` | WP-Kalibrierung als Zustandsmaschine (pure Logik): heizt auf Soll-Temperatur, misst Leistung/Temperatur, filtert Störungen (z. B. Waschmaschine) heraus, speichert Ergebnis (Dauer, Verbrauch, Ø-Leistung). |
| `detector.py` | Automatische Erkennung (pure Logik): bewertet Entitäten nach Name, Geräteklasse, Einheit, Domain sowie Hersteller-/Modell- und Integrations-Signalen (Wortgrenzen statt „irgendwo im Namen“), gruppiert Geräte-Sets (z. B. Wallbox mit Leistung + Start-/Stopp-Tastern) und liefert Kandidaten mit Begründung und Live-Wert. Der Benutzer bestätigt immer. |

### Eigene Oberfläche (Panel – ersetzt Lovelace)

| Datei | Beschreibung |
| :--- | :--- |
| `panel.py` | Registriert die Seitenleisten-Seite „PV Manager“ (`/pvm`) als Custom-Panel mit `embed_iframe` (Mechanik wie HACS), serviert `panel/panel.js` über `async_register_static_paths` und entfernt ein früheres Lovelace-Dashboard (`pvm-dashboard`) automatisch. |
| `panel_data.py` | Baut das **Entitäten-Mapping** (unique_id → entity_id über die Registry) und das komplette Datenpaket für die Seite (Konfiguration, Scan-Ergebnis, Setup-Stufe, Version). Bewusst weitgehend pur gehalten → unit-testbar. |
| `websocket.py` | Vier WebSocket-Kommandos, über die die Seite ausschließlich mit HA spricht: `pvm/get_config`, `pvm/save_config` (normalisiert + speichert), `pvm/scan`, `pvm/list_entities`. |
| `panel/panel.js` | Die **komplett selbst gebaute Oberfläche** (HTML/CSS/JS, keine Frameworks): Reiter Erste Schritte/Übersicht/Geräte/Reihenfolge/Gefunden/Einstellungen, animierter Energiefluss, eigene Geräte-Dialoge mit dynamischen Feldern (je Steuerungsart), Design-Wechsel mit Animation, deutsche Texte. Liest Live-Zustände über das `hass`-Objekt und schreibt Änderungen per WebSocket zurück. |

### Entitäten-Plattformen

| Datei | Stellt bereit | Beispiele |
| :--- | :--- | :--- |
| `sensor.py` | Sensoren | PV-Überschuss, PVM-Status, Setup-Stufe, Geräte-Status, WP-Test-Ergebnis |
| `number.py` | Zahlen | Mindest-/Max-SOC, Leistungs-Limits, Soll-/Notfall-Temperatur, Reserve, Zyklus- und Mindestzeiten |
| `switch.py` | Schalter | Gerät-Automatik, Power Charge, Netzstrom-Freigaben (normale HA-Entitäten, vom Panel wie von HA aus bedienbar) |
| `button.py` | Buttons | Geräte suchen, Seite neu registrieren, WP-Test starten/abbrechen |
| `select.py` | Auswahl | Betriebsmodus (Auto/Nur Überschuss/Nur Ziele/Aus), Design (3 Themes) |
| `time.py` | Uhrzeit | Frist-Ziele (bis wann soll das Ziel erreicht sein) |

> Die Entitäten bleiben normale Home-Assistant-Entitäten (für Automatisierungen,
> Dashboards und Sprachsteuerung nutzbar) – das eigene Panel ist zusätzlich die
> schönste und vollständigste Oberfläche.

### Services, Diagnose & Texte

| Datei | Beschreibung |
| :--- | :--- |
| `services.py` | Implementiert die 9 Services: `power_charge`, `set_priority`, `set_deadline`, `clear_deadline`, `wp_test_start`, `wp_test_abort`, `scan_devices`, `rebuild_dashboard` (Seite neu registrieren), `run_self_test`. |
| `services.yaml` | Service-Definitionen mit deutschen Beschreibungen – für die Service-UI in Home Assistant. |
| `diagnostics.py` | Strukturierter Diagnose-Export (Einstellungen, Geräte, Fehlerzähler, Store-Status). |
| `translations/de.json`, `en.json` | Alle Texte der Entitäten – deutsch primär, englisch als Fallback, vollständig abgestimmt. |

---

## 🔄 Datenflüsse

### Steuerzyklus (alle 30 s)

```
Timer (alle 30 s)
   │
   ▼
manager.py: Energie lesen (PV, Netz, Haus)          ──► Sensor-Ausfall? → letzter gültiger Wert
   │
   ▼
manager.py: Geräte-Zustand sammeln (SoC, Leistung, Ziele)
   │
   ▼
engine.py: Überschuss berechnen & verteilen          ──► Prioritätenliste (▲/▼)
   │                                                     Hysterese + Mindest-Schaltzeiten
   ▼
manager.py: Befehle ausführen                        ──► Schalter, Nummern, Services
   │
   ▼
store.py: Zustand sichern                            ──► Fehler? → Backoff, Log, Neustart
```

### Panel (Browser ↔ Home Assistant)

```
panel/panel.js (Browser)
   │  haptic: Klick auf „Speichern“, Scan, Gerät hinzufügen …
   ▼
WebSocket (authentifiziert, Same-Origin-iframe)
   │  pvm/get_config · pvm/save_config · pvm/scan · pvm/list_entities
   ▼
websocket.py ──► manager.async_replace_config() / scan_devices() / collect_entities()
   │                 │
   ▼                 ▼
panel_data.py    store.py (JSON) → Engine (nächster Zyklus)
```

---

## 🛡️ Ausfallsicherheit

| Maßnahme | Wo |
| :--- | :--- |
| Fehler-Backoff + Engine-Neustart nach 3 Fehlern | `manager.py` |
| Letzte gültige Messwerte statt Raten bei Sensorausfall | `manager.py`, `engine.py` |
| Pure Logik ohne HA-Importe → testbar ohne Installation | `engine.py`, `wp_test.py`, `panel_data.py`, … |
| Kein YAML, keine Eingriffe in `configuration.yaml` | `store.py` |
| Seite statisch ausgeliefert, ohne Cache | `panel.py` (`cache_headers=False`) |
| Altes Lovelace-Dashboard wird beim Start automatisch entfernt (keine doppelten Seiten) | `panel.py::_remove_old_lovelace_dashboard` |
| Jede Speicherung aus dem Panel wird normalisiert/validiert | `websocket.py`, `config_model.py` |
| Timeouts und Try/Except bei allen Service-Aufrufen | `manager.py` |
| Import-Smoke-Tests laden alle Module ohne HA-Installation | `tests/test_imports.py` |

---

## 🔌 Neue Geräte & Erweiterungen

1. **Neue Rolle/Steuerung** → Entitäten-Katalog in `panel_data.py` (`_kinds_for_role`/`DEVICE_PREFIXES`), Dialog-Felder in `panel/panel.js`, Verhalten in `engine.py`, Ausführung in `manager.py`.
2. **Neue Seite/Reiter im Panel** → direkt in `panel/panel.js` bauen; Daten über ein bestehendes oder neues WebSocket-Kommando in `websocket.py` liefern.
3. **Neue Übersetzung** → `translations/de.json` und `en.json` parallel erweitern.
4. **Tests** → Tests in `tests/` ergänzen, `ruff` + `pytest` lokal ausführen.

Ausführlicher Leitfaden: [docs/development.md](development.md).

---

*Zurück zur [Hauptdokumentation](../README.md).*
