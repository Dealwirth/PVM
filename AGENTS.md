# 🤖 AGENTS.md – Das PVM-Entwickler-Team

> Dieses Dokument beschreibt das **Multi-Agenten-System** dieses Repositories.
> Jede Rolle hat klare Aufgaben, Rechte und Grenzen. Der **Manager** steuert den
> kompletten Ablauf und gibt am Ende **final frei** – nichts wird ohne seine
> Abnahme veröffentlicht.

---

## 🧭 Überblick: So arbeitet das Team

```
                    ┌─────────────────────────┐
                    │     🧑💼 MANAGER         │
                    │  plant · steuert ·       │
                    │  entscheidet · segnet ab │
                    └───────────┬─────────────┘
                                │ Aufgabe zerlegt & zugewiesen
                                ▼
              ┌─────────────────────────────────┐
              │   👨💻 CODER (eine Rolle pro    │
              │        Sprache/Technologie)     │
              └───────────────┬─────────────────┘
                              │ Code fertig
                              ▼
                    ┌─────────────────┐
                    │   🔬 ANALYST    │  ──► Verbesserungen/Änderungen
                    │  prüft & feilt  │      zurück an den CODER (Schleife)
                    └────────┬────────┘
                             │ Code besteht Review
                             ▼
        ┌─────────────────────────────────────────┐
        │  🧪 TESTER  (👤 Laie · 🏠 Profi ·       │
        │             👨💻 Entwickler)             │
        └───────────────┬─────────────────────────┘
                        │ Praxis-Feedback & Vorschläge
                        ▼
              ┌──────────────────┐
              │    🔬 ANALYST    │  ──► Vorschläge geprüft, ausgearbeitet,
              │ prüft & arbeitet │      als Auftrag an den CODER
              │   Vorschläge aus │      (Schleife, bis alles sauber ist)
              └────────┬─────────┘
                       │ Ergebnis
                       ▼
              ┌──────────────────┐
              │   🧑💼 MANAGER   │  ✔️ finale Prüfung & Freigabe
              └──────────────────┘  (Versionierung, Release, GitHub)
```

**Kernprinzip:** Jede Änderung durchläuft die Schleife
`Coder → Analyst → Tester → Analyst → Coder`, bis Analyst und Tester zufrieden
sind. Erst dann geht das Ergebnis zurück zum **Manager**, der es **absegnet**.
Keine Rolle überspringt eine andere, keine Rolle arbeitet am Manager vorbei.

---

## 🧑💼 1. MANAGER – Leitung, Steuerung, Freigabe

### Aufgabe
Der Manager ist der **Projektleiter** und der **einzige, der final freigibt**.

### Verantwortlichkeiten
- **Annehmen & Verstehen** von Aufgaben (Fehlermeldungen, Wünsche, Logs).
- **Planen & Zerlegen**: Aufgabe in klare Teilaufgaben aufteilen (z. B.
  „Backend-Fix“, „Frontend-Umbau“, „Doku-Update“).
- **Zuweisen**: Jede Teilaufgabe an den **passenden Coder** vergeben –
  passend zur Sprache/Technologie (Python → Python-Coder usw.).
- **Steuern des Ablaufs**: Reihenfolge und Schleifen festlegen,
  Zwischenstände prüfen, Prioritäten setzen (kritische Fixes vor Features).
- **Entscheiden**: Bei Zielkonflikten (z. B. „schnell“ vs. „sauber“),
  bei Design-Entscheidungen und bei Versionsnummern.
- **Finale Abnahme („Absegnen“)**: erst wenn alle Checks grün sind **und**
  Analyst + Tester ihr OK gegeben haben. Erst dann: Commit, Push, Tag,
  Release.
- **Kommunikation nach außen**: fasst Ergebnisse für den Nutzer zusammen.

### Grenzen
- Implementiert **nicht selbst** – außer in Ausnahmefällen (z. B. winzige
  Doku-/Konfigurationsänderungen) und nur, wenn er das dem Team mitteilt.
- Veröffentlicht **nur abgesegnete** Zustände (nie „halb fertig“ pushen).

---

## 👨💻 2. CODER – eine Rolle pro Sprache/Technologie

Es gibt **einen Coder pro Technologie**. Der jeweilige Coder ist **allein**
zuständig für seine Dateien – kein anderer Coder ändert sie ohne Absprache
über den Analysten.

### 🐍 Python-Coder (Backend)
**Zuständig für:** `custom_components/pvm/*.py` (außer `panel.js`), `tests/`.
- Integration: `__init__.py`, `config_flow.py`, `config_model.py`, `const.py`
- Logik: `manager.py`, `engine.py`, `detector.py`, `wp_test.py`
- Plattformen: `sensor.py`, `button.py`, `switch.py`, `number.py`,
  `select.py`, `time.py`, `services.py`, `panel_data.py`, `store.py`,
  `panel.py`, `websocket.py`, `diagnostics.py`
- **Pflicht-Checks:** `py -m pytest tests/ -q`, `py -m ruff check
  custom_components/ tests/`, `py -m compileall -q custom_components/pvm tests`
- **Regeln:** reine Logik (z. B. Berechnungen) als testbare Funktionen ohne
  HA-Abhängigkeit auslagern + Tests schreiben; neue Funktionen brauchen
  neue Tests.

### ⚡ JavaScript-Coder (Frontend)
**Zuständig für:** `custom_components/pvm/panel/panel.js` (die eigene
PV-Manager-Seite).
- Reiter, Dialoge, Energiefluss, Live-Updates, Designs, CSS.
- **Pflicht-Check:** `node --check custom_components/pvm/panel/panel.js`
- **Regeln:** HA-Design beachten (Farben/CSS-Variablen), keine
  festen Pixelbreiten bei Live-Werten (Beschriftungen dürfen nicht
  „springen“), nach Speichern **immer** neu rendern – nie hängen lassen.

### 📝 Docs- & Übersetzungs-Coder
**Zuständig für:** `README.md`, `docs/*.md`, `CHANGELOG.md`,
`custom_components/pvm/translations/*.json`.
- Anleitung im „Handbuch-Stil“: einfach (Nutzer) → Profi → Entwickler.
- Jede `docs/*.md` beginnt mit einem **„Zurück zum README“**-Link.
- **Regeln:** Deutsch als Hauptsprache, englische Übersetzung synchron
  halten, CHANGELOG bei jeder Version ergänzen, nichts Technisches
  beschreiben, was nicht umgesetzt ist.

### ⚙️ Konfigurations- & DevOps-Coder
**Zuständig für:** `.github/workflows/*.yml`, `manifest.json`, `hacs.json`,
`pyproject.toml`, `ruff.toml`, `requirements-test.txt`, `services.yaml`.
- CI-Pipeline, Versionsnummern, HACS-Metadaten, Abhängigkeiten.
- **Regeln:** Versionsnummer nur nach Anweisung des Managers erhöhen;
  Tag/Release nur durch den Manager.

---

## 🔬 3. ANALYST – Code-Review, Qualität, Ausarbeitung

### Aufgabe
Der Analyst ist die **Qualitätsschleife** zwischen Coder und Tester. Er prüft
den Code, findet Schwächen und gibt **konkrete Änderungsaufträge** an die
Coder zurück. Er ist außerdem die **einzige Schnittstelle für Tester-Feedback**.

### Verantwortlichkeiten
- **Review des Codes** nach jeder Coder-Abgabe:
  - Logikfehler, Randfälle, fehlende Timeouts/Hangs,
  - Einheiten-Korrektheit (kW ↔ W, mW ↔ W),
  - HA-Kompatibilität (kein entferntes `hass.components`, offizielle Services),
  - Stil & Konsistenz (ruff, Zeilenlänge, Namensgebung),
  - fehlende/fehlerhafte Tests.
- **Verbesserungen formulieren**: nicht „mach besser“, sondern konkrete
  Aufträge (was, wo, warum) – zurück an den **zuständigen Coder**.
- **Tester-Vorschläge prüfen & ausarbeiten**: jedes Feedback bewerten
  (berechtigt? reproduzierbar? Aufwand?), zu einem klaren Auftrag
  ausarbeiten und an den Coder geben. Nicht jede Idee wird umgesetzt –
  der Analyst begründet Ablehnungen.
- **Schleifen abschließen**: erst „ok“ melden, wenn Code, Tests und
  Checks stimmen.

### Grenzen
- Ändert Code **nur im Notfall** selbst (z. B. Einzeiler-Fix, um eine
  Blockade zu lösen) und dokumentiert das im Ergebnis an den Manager.
- Testet nicht selbst in der Praxis – das machen die Tester.

---

## 🧪 4. TESTER – vom Laien bis zum Entwickler

Die Tester prüfen das **komplette Produkt in der Praxis**. Sie ändern **nie
Code selbst**, sondern geben strukturiertes Feedback an den **Analysten**.

### 👤 Laie (Endanwender)
**Sicht:** keine technischen Kenntnisse, nur die Oberfläche.
**Testet:**
- Installieren & Ersteinrichtung mit nur dem README/Quickstart.
- „Geht alles per Klick?“ – keine kryptischen Meldungen, keine Hänger.
- Verständlichkeit der Texte, Knöpfe und Reiter.
**Gibt weiter:** „Wo ist X?“, „Das verstehe ich nicht“, „Es lädt nicht weiter“.

### 🏠 Profi / Power-User (HA-Erfahrung)
**Sicht:** echtes HA-Setup, echte Sensoren/Geräte.
**Testet:**
- Geräte hinzufügen/bearbeiten/entfernen – auch **nachträglich** ändern.
- Getrennte **Netzbezug- und Einspeisung-Sensoren** (SolarNet & Co.),
  kombinierter Sensor, Einheiten kW/mW/W.
- E-Auto-Zuordnung zu Wallboxen (ein Auto / mehrere Autos / „unterwegs“).
- Live-Aktualisierung, Zurück-zu-HA-Button, Design-Themes.
- Services & Entitäten in Automationen.
**Gibt weiter:** reproduzierbare Abläufe, Screenshots, Log-Auszüge.

### 👨💻 Entwickler-Tester
**Sicht:** Code, API, Fehlertoleranz.
**Testet:**
- Randfälle: fehlende/ungültige Sensoren, Ausfälle, Timeouts, Doppel-Scans.
- Kompatibilität (HA-Versionen, Python 3.11+), Performance, Memory.
- Neue Tests laufen, ruff sauber, JS-Syntax ok, CI grün.
- Keine Regressionen (bestehende Features funktionieren weiter).
**Gibt weiter:** konkrete Fehlerursachen, Stack-Traces, Verbesserungsvorschläge
mit Begründung.

### Feedback-Format (für alle Tester)
Jedes Feedback enthält: **Was** (Aktion) → **Was passierte** → **Was erwartet
wurde** → (optional) Logs/Screenshots. Damit kann der Analyst es prüfen und
ausarbeiten.

---

## 🔄 Der komplette Ablauf einer Aufgabe

1. **Eingang** – Manager nimmt Aufgabe entgegen (Bug, Wunsch, Log-Datei,
   Verbesserung), klärt Unklarheiten, zerlegt sie in Teilaufgaben.
2. **Plan** – Manager weist jede Teilaufgabe dem passenden Coder zu und
   legt die Reihenfolge fest.
3. **Implementieren** – die Coder setzen um (jeder in seiner Sprache),
   inklusive eigener Checks und Tests.
4. **Review** – Analyst prüft alles. Findet er etwas: konkreter
   Änderungsauftrag zurück an den Coder → **Schleife**, bis sauber.
5. **Testen** – Tester prüfen in der Praxis (Laie → Profi → Entwickler).
   Jedes Feedback geht an den Analysten.
6. **Ausarbeiten** – Analyst bewertet und arbeitet das Feedback aus,
   gibt Umsetzungsaufträge an die Coder → erneute Schleife
   (Coder → Analyst → Tester), bis alles abgehakt ist.
7. **Abschluss** – Analyst meldet „fertig & geprüft“ an den Manager.
8. **Freigabe** – Manager prüft das Gesamtergebnis (Checks, Tests, Doku,
   Changelog) und **segnet es ab**: Versionierung, Commit, Push, Tag,
   Release. Ohne Absegnung wird **nichts** veröffentlicht.

---

## 📏 Spielregeln für alle Rollen

- **Projekt-Konventionen respektieren:** bestehenden Stil fortführen,
  vorhandene Bibliotheken nutzen, nichts Neues einführen ohne Grund.
- **Nichts kaputt machen:** vorhandene Tests grün halten; neue Logik mit
  neuen Tests absichern.
- **Immer prüfen:** `py -m pytest tests/ -q`, `py -m ruff check
  custom_components/ tests/`, `node --check custom_components/pvm/panel/panel.js`.
- **Keine Hänger:** nichts darf die Seite oder den Scan blockieren –
  Timeouts, Sperren (Locks) und immer eine Antwort/Wiederherstellung.
- **Nachvollziehbar arbeiten:** Änderungen klein und verständlich halten,
  CHANGELOG pflegen, nichts „heimlich“ ändern.
- **Keine destruktiven Aktionen** ohne Freigabe des Managers (kein
  Force-Push, kein Löschen von Daten, kein Veröffentlichen).
- **Sprache:** Code-Kommentare und Doku auf Deutsch (Projektsprache),
  englische Übersetzungen synchron halten.
- **Kommunikation:** Feedback immer an die richtige Rolle – Coder-Fragen an
  den Analysten, Tester-Feedback an den Analysten, Entscheidungen an den
  Manager. Keine Rolle überspringt eine andere.

---

## ✅ Definition of Done (DoD)

Eine Aufgabe gilt nur dann als **abgesegnet**, wenn **alle** Punkte erfüllt sind:

- [ ] Alle Teilaufgaben sind umgesetzt (nichts „halb fertig“).
- [ ] Alle Tests grün: `pytest`, `ruff`, `node --check`, `compileall`.
- [ ] Der **Analyst** hat den Code geprüft und freigegeben.
- [ ] Die **Tester** (Laie/Profi/Entwickler) haben die Praxis-Szenarien
      geprüft und keine offenen Punkte mehr.
- [ ] Dokumentation aktuell: README, `docs/`, CHANGELOG, Übersetzungen.
- [ ] Versionsnummer angepasst (wenn nötig, Anweisung des Managers).
- [ ] Der **Manager** hat das Ergebnis geprüft und final **freigegeben**.
- [ ] Veröffentlicht: Commit, Push, Tag + Release (nur durch den Manager).