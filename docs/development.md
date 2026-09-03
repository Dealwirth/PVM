# Entwicklung

## Überblick

PVM ist modular aufgebaut. Wichtigster Grundsatz: **Alle Entscheidungs-Logik ist
reines Python ohne Home-Assistant-Importe** und damit vollständig unit-testbar.
Die Home-Assistant-Schicht ist dünn und kümmert sich nur um Zustände,
Service-Aufrufe und Entitäten.

| Bereich | Dateien | Abhängigkeiten |
| --- | --- | --- |
| Konfigurations-Modell | `config_model.py`, `const.py` | nur Python |
| Steuer-Engine (Logik) | `engine.py` | nur Python |
| WP-Test (Zustandsmaschine) | `wp_test.py` | nur Python |
| Geräteerkennung | `detector.py` | nur Python |
| Dashboard-Aufbau | `dashboard_builder.py` | nur Python |
| Laufzeit + Zyklus | `manager.py`, `store.py` | Home Assistant |
| Entitäten | `sensor.py`, `number.py`, `switch.py`, `button.py`, `select.py`, `time.py` | Home Assistant |
| Wizard/Options | `config_flow.py` | Home Assistant |
| Dashboard-Erstellung | `dashboard_creator.py` | Home Assistant |
| Services/Diagnose | `services.py`, `services.yaml`, `diagnostics.py` | Home Assistant |
| Einstieg | `__init__.py`, `manifest.json` | Home Assistant |

## Der Steuerzyklus

Alle `cycle_s` Sekunden (Standard 30 s):

1. **Manager** liest die Energie-Sensoren (Netz/PV/Haus) und berechnet den
   verfügbaren Überschuss (abzüglich Reserve).
2. **Manager** baut aus Konfiguration und Messwerten `CycleInput`
   (Dataclasses in `engine.py`).
3. **Engine** (`compute_plan`) entscheidet pro Gerät: an/aus, Leistung, Grund
   (Reason-Code) – Garantie-Läufe zuerst, dann Überschuss nach Priorität.
4. **Manager** führt die Aktionen aus (Schalter, Sollwert-Service-Aufrufe),
   achtet auf Mindest-Ein-/Ausschaltzeiten und speichert Zustandsänderungen.
5. Sensoren werden benachrichtigt; bei Fehlern zählt ein Zähler, nach 3 Fehlern
   pausiert der Zyklus kurz und startet selbstständig wieder.

## Neue Geräte-/Steuerungsprofile

Eine neue *Rolle* braucht in der Regel **keinen Code**:

1. Im Wizard/Options-Flow Formularfelder ergänzen (`config_flow.py`).
2. Entitäten-Katalog und Dashboard-Karten für die Rolle ergänzen
   (`dashboard_creator.py::_kinds_for_role`, `dashboard_builder.py`).
3. Engine-Verhalten erweitern (`engine.py::_need_forced_on` / `_surplus_want`).

Eine neue *Steuerungsart* (z. B. Service-basiert statt Schalter) wird im Manager
in `_execute_action` ergänzt – dort laufen alle Service-Aufrufe mit Timeout und
Fehlerbehandlung zusammen.

## Testen

```bash
pip install -r requirements-test.txt
ruff check custom_components tests
pytest
```

Die Tests laufen **ohne Home-Assistant-Installation** (`tests/conftest.py`
stellt harmlose Platzhalter für die HA-Importe bereit – nur für die reinen
Logik-Module; die HA-Schicht wird in einer echten Instanz geprüft).

## Code-Stil

- Async/await für alle I/O.
- Type Hints, Google-Docstrings.
- Keine externen Abhängigkeiten außer Home Assistant Core.
- Deutscher UI-Text, englische Schlüssel/IDs.

## CI/CD

- `.github/workflows/validate.yml`: `hassfest`, `ruff`, `pytest` (Python 3.12/3.13).
- `.github/workflows/release.yml`: Tag `v*` → GitHub-Release (HACS zeigt das Update an).

## Pull Requests

- Branch von `main` abzweigen, Änderungen in `CHANGELOG.md` ergänzen.
- `ruff` und `pytest` müssen grün sein.
- Der Selbstdiagnose-Service `pvm.run_self_test` sollte nach größeren Änderungen
  auf einer echten Instanz laufen.
