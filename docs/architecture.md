# 🏗️ Architektur & Struktur

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
│       ├── __init__.py                Einstiegspunkt, Plattform-Setup, Services, Diagnose
│       ├── manifest.json              Manifest (Domain, Version, Anforderungen)
│       ├── const.py                   Konstanten, Standardwerte, Beschriftungen
│       ├── config_model.py            Geräte- und Integrations-Datenmodell (pure Logik)
│       ├── config_flow.py             Verwaltung (kein Wizard): Messungen, Geräte, Erkennung
│       ├── store.py                   JSON-Persistenz (speichert alle Einstellungen)
│       ├── manager.py                 Herzstück: Steuerzyklus, Service-Aufrufe, WP-Test, Scan
│       ├── engine.py                  Prioritäts-Engine (reine Logik, keine HA-Importe)
│       ├── detector.py                Automatische Geräteerkennung (pure Logik)
│       ├── wp_test.py                 WP-Kalibrierung als Zustandsmaschine (pure Logik)
│       ├── dashboard_builder.py       Dashboard-Aufbau als Datenstruktur (pure Logik)
│       ├── dashboard_creator.py       Dashboard-Erstellung über Lovelace-API
│       ├── sensor.py                  Sensor-Plattform (PVM-Status, Geräte-Sensoren)
│       ├── number.py                  Zahlen-Plattform (SOC-Ziele, Leistungs-Limits)
│       ├── switch.py                  Schalter-Plattform (Ein/Aus + UI-Gruppen)
│       ├── button.py                  Button-Plattform (Scan, Dashboard-Neubau, WP-Test)
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
    ├── conftest.py                    HA-Stubs für reine Logik-Tests
    ├── test_config_model.py           Datenmodell-Tests
    ├── test_dashboard_builder.py      Dashboard-Aufbau-Tests
    ├── test_detector.py               Erkennungs-Tests
    ├── test_engine.py                 Engine-Tests (Prioritäten, Ziele, Hysterese)
    └── test_wp_test.py                WP-Test-Tests
```

---

## 🧠 Architektur im Überblick

PVM folgt einem **zweischichtigen Design**:

| Schicht | Dateien | Aufgabe |
| :--- | :--- | :--- |
| **Pure Logik** | `engine.py`, `wp_test.py`, `detector.py`, `config_model.py`, `dashboard_builder.py` | Reines Python ohne Home-Assistant-Importe → vollständig unit-testbar, läuft überall |
| **HA-Anbindung** | `manager.py`, `config_flow.py`, alle Plattformen, `store.py` | Übersetzt Home Assistant in die pure Logik und zurück |

Vorteil: Die kritischen Entscheidungen (wer bekommt wann wie viel Strom) sind **ohne HA-Installation testbar** – das ist der Grund, warum PVM so ausfallsicher ist.

---

## 📦 Die Module im Detail

### Einstieg & Konfiguration

| Datei | Beschreibung |
| :--- | :--- |
| `__init__.py` | Einstiegspunkt der Integration: lädt Konfiguration, startet den Manager, registriert Plattformen, Services und Diagnose. |
| `manifest.json` | HACS-/HA-Manifest: `domain: pvm`, Version, Anforderungen (2025.2+). |
| `const.py` | Alle Konstanten: Standardwerte (Mindest-Ladeleistung 1,4 kW, Reserve, Zyklus 30 s), Geräte-Rollen, Entitäts-Kataloge, Übersetzungs-Schlüssel. |
| `config_model.py` | Datenmodell: normalisiert gespeicherte Geräte, liefert Standardwerte, validiert. Reine Logik. |
| `config_flow.py` | Kein Installations-Wizard: Eintrag entsteht in einem Klick. Options-Flow mit kurzen Einzel-Dialogen: Messungen („habe ich / habe ich nicht“), Geräte (dynamische Felder je Steuerungsart inkl. Zwei-Taster), Übernahme gefundener Sensoren/Geräte, erweiterte Werte. |
| `store.py` | JSON-Persistenz im HA-Store (`.storage/pvm`). Jede Änderung wird sofort gespeichert. |

### Steuerung (Herzstück)

| Datei | Beschreibung |
| :--- | :--- |
| `manager.py` | **Der Steuerzyklus**: alle 30 Sekunden Energie lesen → Engine aufrufen → Befehle ausführen. Verwaltet außerdem WP-Test, Geräte-Scan, Frist-Ziele, Fehler-Backoff (3 Fehler → Pause → Neustart) und die letzten gültigen Messwerte. |
| `engine.py` | **Die Prioritäts-Engine** (pure Logik): verteilt Überschuss nach Prioritätsliste, beachtet Mindest-Ladeleistung, Leistungs-Limits, Hysterese, Mindest-Ein-/Ausschaltzeiten, Frist-Ziele, Mindest-/Max-SOC und Power Charge. |
| `wp_test.py` | WP-Kalibrierung als Zustandsmaschine (pure Logik): heizt auf Soll-Temperatur, misst Leistung/Temperatur, filtert Störungen (z. B. Waschmaschine) heraus, speichert Ergebnis (Dauer, Verbrauch, Ø-Leistung). |
| `detector.py` | Automatische Erkennung (pure Logik): bewertet Entitäten nach Name, Geräteklasse, Einheit, Domain sowie Hersteller-/Modell- und Integrations-Signalen (Wortgrenzen statt „irgendwo im Namen“), gruppiert Geräte-Sets (z. B. Wallbox mit Leistung + Start-/Stopp-Tastern) und liefert Kandidaten mit Begründung und Live-Wert. Der Benutzer bestätigt immer. |

### Dashboard

| Datei | Beschreibung |
| :--- | :--- |
| `dashboard_builder.py` | Baut die Dashboard-Struktur als reine Datenstruktur: 5 Ansichten (Start & Tutorial, Übersicht, Geräte, Reihenfolge, Einstellungen), aufklappbare Einstellungs-Gruppen (conditional-Karten) und drei umschaltbare Design-Pakete (Sonnenaufgang/Natur-frisch/Kühl & klar). |
| `dashboard_creator.py` | Überträgt die Struktur über die offizielle Lovelace-Speicher-API in HA, registriert das Dashboard in der Seitenleiste, wiederholt im Hintergrund bei Fehlern und aktualisiert nur bei Struktur-/Design-Änderungen (Marker „dashboard_rebuild“). |

### Entitäten-Plattformen

| Datei | Stellt bereit | Beispiele |
| :--- | :--- | :--- |
| `sensor.py` | Sensoren | PV-Überschuss, PVM-Status, Geräte-Status, WP-Test-Ergebnis |
| `number.py` | Zahlen | Mindest-/Max-SOC, Frist-Ziel, Leistungs-Limits, Soll-/Notfall-Temperatur, Zyklus- und Mindestzeiten |
| `switch.py` | Schalter | Gerät ein/aus, Power Charge, Netzstrom-Freigabe |
| `button.py` | Buttons | Geräte suchen, Dashboard neu bauen, WP-Test starten/abbrechen |
| `select.py` | Auswahl | Betriebsmodus (Auto/Nur Überschuss/Aus), Reserve-Stufe |
| `time.py` | Uhrzeit | Frist-Ziele (bis wann soll das Ziel erreicht sein) |

### Services, Diagnose & Texte

| Datei | Beschreibung |
| :--- | :--- |
| `services.py` | Implementiert die 9 Services: `set_priority`, `power_charge`, `set_deadline`, `clear_deadline`, `scan_devices`, `rebuild_dashboard`, `set_energy_sensors`, `set_device_state`, `run_self_test`. |
| `services.yaml` | Service-Definitionen mit deutschen Beschreibungen – für die Service-UI in Home Assistant. |
| `diagnostics.py` | Strukturierter Diagnose-Export (Einstellungen, Geräte, Fehlerzähler, Store-Status). |
| `translations/de.json`, `en.json` | Alle Texte der Optionen und Entitäten – deutsch primär, englisch als Fallback, vollständig abgestimmt. |

---

## 🔄 Datenfluss im Steuerzyklus

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

---

## 🛡️ Ausfallsicherheit

| Maßnahme | Wo |
| :--- | :--- |
| Fehler-Backoff + Engine-Neustart nach 3 Fehlern | `manager.py` |
| Letzte gültige Messwerte statt Raten bei Sensorausfall | `manager.py`, `engine.py` |
| Pure Logik ohne HA-Importe → testbar ohne Installation | `engine.py`, `wp_test.py`, … |
| Kein YAML, keine Eingriffe in `configuration.yaml` | `store.py` |
| Dashboard nie ungefragt überschreiben | `dashboard_creator.py` |
| Timeouts und Try/Except bei allen Service-Aufrufen | `manager.py` |

---

## 🔌 Neue Geräte & Erweiterungen

1. **Neue Rolle/Steuerung** → Dialog-Felder in `config_flow.py`, Entitäten-Katalog in `dashboard_creator.py`/`dashboard_builder.py`, Verhalten in `engine.py`, Ausführung in `manager.py`.
2. **Neue Übersetzung** → `translations/de.json` und `en.json` parallel erweitern.
3. **Tests** → Tests in `tests/` ergänzen, `ruff` + `pytest` lokal ausführen.

Ausführlicher Leitfaden: [docs/development.md](development.md).

---

*Zurück zur [Hauptdokumentation](../README.md).*