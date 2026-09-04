# Entwicklung (für Entwickler)

> 📖 **PV Manager – Dokumentation** · [⬅️ Zurück zum README](../README.md) · [Architektur](architecture.md)

## Überblick

PVM ist modular aufgebaut. Wichtigster Grundsatz: **Alle Entscheidungs-Logik ist
reines Python ohne Home-Assistant-Importe** und damit vollständig unit-testbar.
Die Home-Assistant-Schicht ist dünn und kümmert sich nur um Zustände,
Service-Aufrufe und Entitäten. Die Oberfläche ist eine **komplett eigene
HTML/JS/CSS-Seite** (`panel/panel.js`), kein Lovelace.

| Bereich | Dateien | Abhängigkeiten |
| --- | --- | --- |
| Konfigurations-Modell | `config_model.py`, `const.py` | nur Python |
| Steuer-Engine (Logik) | `engine.py` | nur Python |
| PV-Prognose | `forecast.py` | nur Python (Open-Meteo-Aufruf im Manager) |
| Geräteerkennung | `detector.py` | nur Python |
| Panel-Daten (Mapping/Payload) | `panel_data.py` | nur Python (Registry wird reingereicht) |
| Laufzeit + Zyklus | `manager.py`, `store.py` | Home Assistant |
| Entitäten | `sensor.py`, `number.py`, `switch.py`, `button.py`, `select.py`, `time.py` | Home Assistant |
| Ein-Klick-Installation | `config_flow.py` | Home Assistant |
| Panel-Registrierung + Seite | `panel.py`, `websocket.py`, `panel/panel.js` | Home Assistant (bzw. Browser) |
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

## Die eigene Seite (Panel)

- **Registrierung** (`panel.py`): statische Dateien unter `/pvm_panel`
  (`async_register_static_paths`), Seitenleisten-Panel über
  `async_register_built_in_panel` mit `component_name="custom"`,
  `_panel_custom` + `embed_iframe: true` (identisch zum HACS-Mechanismus).
  Die Seite läuft als Same-Origin-iframe und bekommt das authentifizierte
  `hass`-Objekt.
- **Daten** (`panel_data.py`): `build_panel_payload(manager)` liefert
  Konfiguration + Entitäten-Mapping + Scan-Ergebnis + Setup-Stufe.
  `build_entity_map(registry, config)` bildet unique_id → entity_id ab.
- **Kommunikation** (`websocket.py`): die Seite liest/schreibt **nur** über
  die Kommandos `pvm/get_config`, `pvm/save_config`, `pvm/scan`,
  `pvm/list_entities` und `pvm/reload` (letzteres lädt nach Geräte-
  Änderungen die Entitäten nach und antwortet erst, wenn der Reload fertig
  ist – die Seite wartet also nie vergeblich). Neue Daten → neues Kommando
  hier ergänzen.
- **UI** (`panel/panel.js`): eine einzige Datei (HTML-Template + CSS + JS,
  kein Build-Schritt, keine Frameworks). Reiter, Dialoge und Animationen sind
  reines DOM-Handling; Texte sind deutsch. Nach Änderungen: `node --check`
  ausführen (JS-Syntax).
- **Dialoge sind stapelbar:** `openModal()` legt Dialoge auf einen Stapel
  (`state.modalStack`) – der Entitäten-Picker öffnet sich *über* dem
  Geräte-Dialog, ohne ihn zu zerstören. Beim Schließen eines Dialogs wird nur
  der oberste entfernt; erst wenn keiner mehr offen ist, wird der
  Geräte-Dialog-Zustand (`state.deviceDialog`) verworfen. Wird das Panel-
  Element neu erzeugt (Seite erneut geöffnet), zeigt es sofort den letzten
  Stand und lädt parallel frisch – nie endlos „verbindet …“.

## Neue Geräte-/Steuerungsprofile

Eine neue *Rolle* braucht in der Regel **keinen Code in der Engine**:

1. Entitäten-Katalog erweitern: `panel_data.py` → `_kinds_for_role()` und
   `DEVICE_PREFIXES` (Spiegel der Plattform-Module).
2. Geräte-Formular im Panel erweitern: `panel/panel.js` (Felder je Rolle/
   Steuerungsart – erscheinen dynamisch).
3. Engine-Verhalten erweitern (`engine.py::_need_forced_on` /
   `_surplus_want`), falls die Rolle besondere Regeln braucht.

Eine neue *Steuerungsart* (z. B. Service-basiert statt Schalter) wird im Manager
in `_execute_action` ergänzt – dort laufen alle Service-Aufrufe mit Timeout und
Fehlerbehandlung zusammen.

## Testen

```bash
pip install -r requirements-test.txt
ruff check custom_components tests
pytest
node --check custom_components/pvm/panel/panel.js   # JS-Syntax (falls Node vorhanden)
```

Die Tests laufen **ohne Home-Assistant-Installation** (`tests/conftest.py`
stellt harmlose Platzhalter für die HA-Importe bereit). `test_imports.py`
lädt alle Module der Integration als Smoke-Test; `test_panel_data.py` prüft
das Entitäten-Mapping mit einem Registry-Stub. Die HA-Schicht wird in einer
echten Instanz geprüft.

## Prüf-Sandbox (UI-Durchklicken ohne HA)

Unter `sandbox/` liegt eine eigenständige **Prüf-Sandbox**: Sie führt die
**echte** `panel/panel.js` gegen einen simulierten Home-Assistant-
WebSocket aus (Entitäten, Reload, Scan, Live-Ticker). Damit lassen sich die
wichtigsten Nutzer-Abläufe im Browser durchklicken und prüfen:

- Netzanschluss umstellen („ein Sensor“ ↔ „zwei getrennte Sensoren“),
- Geräte hinzufügen / bearbeiten / entfernen (inkl. Entitäten-Picker),
- Auto-Zuordnung live („lädt an Wallbox“ ↔ „unterwegs“),
- Umbenennen, Speichern, Neuaufbau nach Änderungen.

```bash
py sandbox/build_preview.py          # erzeugt sandbox/preview.html (selbst-enthaltend)
# sandbox/preview.html im Browser öffnen – keine Installation nötig
```

Szenario-Buttons oben wechseln die Anschluss-Variante bzw. die Auto-
Situation; jede Änderung durchläuft dieselben WebSocket-Kommandos wie im
echten HA. `sandbox/preview.html` ist generiert und wird nicht eingecheckt
(`.gitignore`); die Quelle der Wahrheit bleibt die echte `panel.js`.

## Code-Stil

- Async/await für alle I/O.
- Type Hints, Google-Docstrings.
- Keine externen Abhängigkeiten außer Home Assistant Core.
- Deutscher UI-Text, englische Schlüssel/IDs.
- `panel/panel.js`: keine externen Libraries, ES2017+, klare Sektionen.

## CI/CD

- `.github/workflows/validate.yml`: `hassfest`, `ruff`, `pytest` (Python 3.12/3.13).
- `.github/workflows/release.yml`: Tag `v*` → GitHub-Release (HACS zeigt das Update an).

## Pull Requests

- Branch von `main` abzweigen, Änderungen in `CHANGELOG.md` ergänzen.
- `ruff` und `pytest` müssen grün sein.
- Der Selbstdiagnose-Service `pvm.run_self_test` sollte nach größeren Änderungen
  auf einer echten Instanz laufen.
