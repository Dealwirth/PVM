# ☀️ PVM – PV Manager
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.2.0+-blue.svg)](https://www.home-assistant.io)
[![GitHub Release](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Dealwirth/PVM/releases)
[![License](https://img.shields.io/github/license/Dealwirth/PVM)](LICENSE)
**PVM** ist dein intelligenter Energiemanager für Home Assistant. Er verteilt deinen PV-Überschuss automatisch an Wallboxen, Wärmepumpe, Waschmaschine und Co. – basierend auf einer **Prioritätenliste**, die du im Dashboard per Klick (▲/▼) festlegst.
<p align="center">
<a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=Dealwirth&repository=PVM&category=integration">
<img src="https://img.shields.io/badge/Integration_hinzufügen-41BDF5?style=for-the-badge&logo=homeassistant&logoColor=white" alt="Integration hinzufügen" width="100%">
</a>
<br>
<em>Klick auf den Button – HACS öffnet sich automatisch.</em>
</p>
<br>
<div align="center">
<table style="border-collapse:collapse;border:none;width:100%;max-width:750px;background:#1a1a2e;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
<tr style="background:#16213e;">
<td colspan="3" style="padding:12px 18px;text-align:center;color:#ffffff;font-size:13px;border:none;">
<span style="color:#4CAF50;">☀️ PV: 4.2 kW</span> &nbsp;•&nbsp; <span style="color:#FFC107;">🏠 Haus: 0.6 kW</span> &nbsp;•&nbsp; <span style="color:#e94560;">🔌 Netz: -0.1 kW</span> &nbsp;•&nbsp; <span style="color:#41BDF5;">⏰ 14:32</span>
</td>
</tr>
<tr>
<td style="padding:16px;width:33%;background:#16213e;border:none;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:14px;">
<div style="color:#41BDF5;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Auto 1</div>
<div style="color:#ffffff;font-size:22px;font-weight:bold;">45%</div>
<div style="background:#0f3460;height:5px;border-radius:3px;margin:8px 0;">
<div style="background:#e94560;width:45%;height:5px;border-radius:3px;"></div>
</div>
<div style="color:#aaaaaa;font-size:11px;">Mindest: ✅ erreicht</div>
<div style="color:#aaaaaa;font-size:11px;">Max: 80% (noch 7.7 kWh)</div>
<div style="color:#4CAF50;font-size:11px;margin-top:6px;">⚡ 2.3 kW (PV)</div>
</div>
</td>
<td style="padding:16px;width:33%;background:#16213e;border:none;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:14px;">
<div style="color:#41BDF5;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Auto 2</div>
<div style="color:#ffffff;font-size:22px;font-weight:bold;">60%</div>
<div style="background:#0f3460;height:5px;border-radius:3px;margin:8px 0;">
<div style="background:#2196F3;width:60%;height:5px;border-radius:3px;"></div>
</div>
<div style="color:#aaaaaa;font-size:11px;">Mindest: ✅ erreicht</div>
<div style="color:#aaaaaa;font-size:11px;">Frist: bis 18:00 auf 80%</div>
<div style="color:#4CAF50;font-size:11px;margin-top:6px;">⚡ 1.3 kW (PV)</div>
</div>
</td>
<td style="padding:16px;width:33%;background:#16213e;border:none;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:14px;">
<div style="color:#41BDF5;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Wärmepumpe</div>
<div style="color:#ffffff;font-size:22px;font-weight:bold;">62 °C</div>
<div style="color:#aaaaaa;font-size:11px;">Soll: 60 °C</div>
<div style="color:#aaaaaa;font-size:11px;">Status: Aus</div>
<div style="color:#aaaaaa;font-size:11px;margin-top:6px;">⚡ 0.0 kW</div>
</div>
</td>
</tr>
<tr>
<td colspan="3" style="padding:8px 18px;background:#16213e;border:none;text-align:center;color:#888888;font-size:11px;border-top:1px solid #1a1a3e;">
⚡ Energiefluss: ☀️ PV 4.2 kW → 🏠 Haus 0.6 kW → 🔌 Netz -0.1 kW &nbsp;|&nbsp; 🚗 Auto 1 2.3 kW &nbsp;•&nbsp; 🚗 Auto 2 1.3 kW
</td>
</tr>
</table>
<br>
<em>Das PVM-Dashboard – sauber, übersichtlich und sofort einsatzbereit.</em>
</div>
---
## 📌 Inhaltsverzeichnis
- [🚀 Schnellstart](#-schnellstart)
- [⚙️ Funktionsweise](#-funktionsweise)
- [❓ Häufige Fragen](#-häufige-fragen)
- [🤖 KI-Support](#-ki-support)
- [🔧 Für Entwickler](#-für-entwickler)
- [📚 Dokumentation](#-dokumentation)
- [📜 Lizenz](#-lizenz)
---
## 🚀 Schnellstart
### Was kann PVM?
PVM ist ein **modulares System** – du musst nicht alle Funktionen nutzen. Es funktioniert genauso gut, wenn du nur eine Wallbox hast oder nur eine Wärmepumpe. Je nachdem, welche Geräte du in Home Assistant integriert hast, stehen dir entsprechende Funktionen zur Verfügung.

- **Automatische PV-Überschussverteilung** an alle deine Verbraucher.
- **E-Auto-Laden** mit Mindest-SOC, Max-SOC und Zeit-Zielen (z. B. „bis 18:00 auf 80 %“).
- **Power Charge** – per Klick mit voller Leistung laden, automatischer Stopp beim Max-SOC.
- **Wärmepumpen-Steuerung** inkl. Testlauf zur Verbrauchsmessung (Kalibrierung).
- **Waschmaschine, Lüftung, Poolpumpe** – alles, was du mit Home Assistant schalten kannst.
- **Automatische Geräteerkennung** – PVM schlägt passende Sensoren vor, du bestätigst per Klick.
- **Fertiges Dashboard** – wird bei der Installation automatisch erstellt und erscheint in der Seitenleiste.
- **Herstellerunabhängig** – jede in HA sichtbare Entität kann gesteuert werden (z. B. auch über evcc, openWB oder Shelly).

### Installation

**Variante 1: Per Button (empfohlen)**

Klicke auf den großen Button oben – HACS öffnet sich automatisch und du kannst die Integration direkt installieren.

**Variante 2: Manuell in HACS**

1. **HACS öffnen** → Drei-Punkte-Menü → **„Custom repositories“**.
2. URL eingeben: `https://github.com/Dealwirth/PVM` → Typ: **„Integration“**.
3. In HACS nach **„PV Manager“** suchen → **Installieren**.
4. **Home Assistant neu starten**.

**Danach (in Home Assistant)**

1. **Einstellungen → Geräte & Dienste → Integration hinzufügen** → „PV Manager“.
2. Im Wizard **„Automatische Einrichtung“** wählen (empfohlen) – PVM füllt die Felder mit Vorschlägen.
3. **Energie-Sensoren** bestätigen (PV und/oder Netz – mindestens einer).
4. **Geräte hinzufügen**: Wallbox/E-Auto, Wärmepumpe, Verbraucher – beliebig oft wiederholen.
5. **Fertig!** Das Dashboard „PV Manager“ erscheint in deiner Seitenleiste.

### Bedienung

- **Prioritäten**: Im Dashboard-Bereich „Prioritäten“ verschiebst du Geräte mit den **▲/▼-Buttons** – was oben steht, bekommt zuerst Strom.
- **Power Charge**: Schalter am Auto antippen – es lädt mit voller Leistung und stoppt automatisch beim Max-SOC.
- **Ziele setzen**: Mindest-/Max-SOC und „Frist-Ziel“ (Uhrzeit + Ziel-SoC) direkt im Dashboard einstellen.
- **WP-Test**: „WP-Test starten“ – die WP heizt einmal bis 70 °C, misst und speichert den Verbrauch.
- **Geräte suchen**: „PVM Geräte suchen“ erkennt neue Sensoren und Wallboxen automatisch.

> **Du musst kein YAML schreiben. Alles geht per Klick.**

---
## ⚙️ Funktionsweise

PVM entscheidet alle 30 Sekunden neu, wer deinen PV-Überschuss bekommt:

1. **Überschuss messen** – über den Netz-Sensor (Import/Export) oder PV minus Hausverbrauch, abzüglich einer kleinen Reserve.
2. **Garantien zuerst** – Power Charge, dringende Frist-Ziele, Mindest-SOC und der WP-Notfall laufen nötigenfalls auch mit Netzstrom.
3. **Überschuss nach Priorität verteilen** – das oberste Gerät zuerst; Leistungs-Limits und Mindest-Ladeleistungen werden beachtet.
4. **Sauber schalten** – Mindest-Ein-/Ausschaltzeiten und Hysterese verhindern Flackern; ungültige Messwerte führen zum Halten statt zum Raten.
5. **Ziele automatisch beenden** – Frist erreicht, Max-SOC erreicht oder Überschuss weg → Gerät wird gestoppt und der Strom geht an das nächste Gerät.

Damit bleibt das System **ausfallsicher**: Ein einzelner Sensorausfall blockiert nichts, nach drei Fehlern pausiert die Engine kurz und startet selbstständig wieder.

---
## ❓ Häufige Fragen

| Frage | Antwort |
| --- | --- |
| Wird nur mit PV-Überschuss geladen? | Standardmäßig ja. Netzstrom fließt nur für Mindest-SOC, Frist-Ziele oder Power Charge – alles per Schalter abschaltbar, Modus „Nur Überschuss“ erzwingt reine PV-Nutzung. |
| Welche Wallboxen werden unterstützt? | Alle, die in Home Assistant als Entität sichtbar sind (Schalter, optional Leistungs-/Strom-Nummer). |
| Warum lädt mein Auto nicht bei 500 W Überschuss? | Unterhalb der Mindest-Ladeleistung (Standard 1,4 kW) startet PVM bewusst nicht. |
| Wie finde ich heraus, was gerade passiert? | Status-Sensoren je Gerät, „PVM Status“ global und der Service `pvm.run_self_test`. |
| Wo kann ich Fehler melden? | [GitHub Issues](https://github.com/Dealwirth/PVM/issues) mit Log (Filter `pvm`) und Diagnose (PV Manager → ⚙ → Diagnose). |

Weitere Details und Lösungen: [docs/faq.md](docs/faq.md).

---
## 🤖 KI-Support

Du brauchst Hilfe bei der Installation oder Einrichtung? Kopiere den folgenden Prompt in deine KI. Sie wird sich zuerst das gesamte Projekt auf GitHub anschauen und sich dann als PVM Assistant vorstellen.

> **KI-Prompt:**
>
> Ich brauche Hilfe bei der Home Assistant-Integration „PVM – PV Manager“ von GitHub (https://github.com/Dealwirth/PVM).
> Bitte lies dir zuerst das README und das gesamte Projekt durch, um es vollständig zu verstehen.
> Die Integration ist ein modularer Energiemanager für PV-Überschuss. Sie kann Wallboxen, Wärmepumpen und andere Verbraucher steuern.
> Stell dich als „PVM Assistant“ vor und frage mich: „Ich bin dein PVM Assistant. Wie kann ich dir helfen?“
> Antworte danach immer kurz, klar und verständlich. Keine langen Erklärungen. Wenn du etwas nicht weißt, frage einfach kurz nach.

---
## 🔧 Für Entwickler

| Thema | Details |
| :--- | :--- |
| **Sprache** | Python 3.11+ |
| **Framework** | Home Assistant Core (Async/Await) |
| **Abhängigkeiten** | HACS (für Installation), keine weiteren externen Libs |
| **Daten** | JSON-Store (`.storage/pvm`) – kein YAML, keine Eingriffe in `configuration.yaml` |
| **Erweiterung** | Neue Geräte-Rollen/Steuerungen über Wizard + Engine (siehe [docs/development.md](docs/development.md)) |
| **Qualität** | `ruff` + `pytest` (ohne HA-Installation) + `hassfest` in CI |

### Struktur

```
custom_components/pvm/
├── engine.py            Prioritäts-Engine (reine Logik)
├── manager.py           Steuerzyklus, Service-Aufrufe, WP-Test, Scan
├── wp_test.py           WP-Kalibrierung (Zustandsmaschine)
├── detector.py          Automatische Geräteerkennung
├── config_flow.py       Setup-Wizard & Optionen
├── dashboard_creator.py Automatische Dashboard-Erstellung
├── sensor.py … time.py  Entitäten-Plattformen
├── translations/        de + en
└── …
```

### Neue Geräte-/Steuerungsprofile

1. Formularfelder im Wizard ergänzen (`config_flow.py`).
2. Entitäten- und Dashboard-Katalog erweitern (`dashboard_creator.py`, `dashboard_builder.py`).
3. Verhalten in der Engine (`engine.py`) bzw. Ausführung (`manager.py`) ergänzen.

### Code-Stil

- **Async/Await** für alle I/O-Operationen.
- **Type Hints** für alle Funktionen.
- **Docstrings** in Google-Style (kurz, präzise).
- Keine externen Abhängigkeiten außer Home Assistant Core.

### Testen

- Lokale Tests mit `pytest` (Tests im `tests/`-Ordner) – **ohne HA-Installation**.
- CI/CD über GitHub Actions (siehe `.github/workflows/validate.yml`).

### Pull Requests

- Branch von `main` abzweigen.
- Änderungen in dieser README und/oder `docs/` dokumentieren, falls relevant.
- Sicherstellen, dass `ruff` und alle Tests durchlaufen.

---
## 📚 Dokumentation

- [Installation](docs/installation.md)
- [Konfiguration](docs/configuration.md)
- [FAQ & Fehlerbehebung](docs/faq.md)
- [Für Entwickler](docs/development.md)

---
## 📜 Lizenz

MIT – siehe [LICENSE](LICENSE).

---

*Made with ❤️ by Dealwirth*
