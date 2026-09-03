# ☀️ PVM – PV Manager
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.2.0+-blue.svg)](https://www.home-assistant.io)
[![GitHub Release](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/Dealwirth/PVM/releases)
[![License](https://img.shields.io/github/license/Dealwirth/PVM)](LICENSE)
**PVM** ist dein intelligenter Energiemanager für Home Assistant. Er verteilt deinen PV-Überschuss automatisch an Wallboxen, Wärmepumpe, Waschmaschine und Co. – basierend auf einer **Prioritätenliste**, die du in der eigenen **PV-Manager-Seite** per Klick (▲/▼) festlegst.
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
<em>Die PV-Manager-Seite – sauber, übersichtlich und sofort einsatzbereit.</em>
</div>
---
## 📌 Inhaltsverzeichnis

<div align="center">
<table style="border-collapse:collapse;border:none;width:100%;max-width:640px;background:#16213e;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
<tr>
<td style="padding:12px 20px;border:none;text-align:left;width:50%;background:#16213e;">
<a href="#-schnellstart" style="color:#41BDF5;text-decoration:none;font-weight:600;">🚀 Schnellstart</a>
</td>
<td style="padding:12px 20px;border:none;text-align:left;width:50%;background:#16213e;">
<a href="#-funktionsweise" style="color:#41BDF5;text-decoration:none;font-weight:600;">🔄 Funktionsweise</a>
</td>
</tr>
<tr>
<td style="padding:12px 20px;border:none;text-align:left;background:#16213e;">
<a href="#-häufige-fragen" style="color:#41BDF5;text-decoration:none;font-weight:600;">❓ Häufige Fragen</a>
</td>
<td style="padding:12px 20px;border:none;text-align:left;background:#16213e;">
<a href="#-ki-support" style="color:#41BDF5;text-decoration:none;font-weight:600;">🤖 KI-Support</a>
</td>
</tr>
<tr>
<td style="padding:12px 20px;border:none;text-align:left;background:#16213e;">
<a href="#-für-entwickler" style="color:#41BDF5;text-decoration:none;font-weight:600;">🔧 Für Entwickler</a>
</td>
<td style="padding:12px 20px;border:none;text-align:left;background:#16213e;">
<a href="#-dokumentation" style="color:#41BDF5;text-decoration:none;font-weight:600;">📚 Dokumentation</a>
</td>
</tr>
<tr>
<td style="padding:12px 20px;border:none;text-align:left;background:#16213e;border-radius:0 0 0 16px;">
<a href="#-lizenz" style="color:#41BDF5;text-decoration:none;font-weight:600;">📜 Lizenz</a>
</td>
<td style="padding:12px 20px;border:none;text-align:left;background:#16213e;border-radius:0 0 16px 0;">
</td>
</tr>
</table>
<br>
<em>Jeder Eintrag springt direkt zum passenden Abschnitt.</em>
</div>

---
## 🚀 Schnellstart

### Was kann PVM?

<div align="center">
<table style="border-collapse:collapse;border:none;width:100%;max-width:750px;background:#1a1a2e;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
<tr>
<td style="padding:10px;border:none;width:50%;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">⚡ Überschuss verteilen</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">Solarstrom priorisiert an Wallbox, WP &amp; Co.</div>
</div>
</td>
<td style="padding:10px;border:none;width:50%;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">🚗 E-Auto laden</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">Mindest-SOC, Max-SOC und Zeit-Ziele.</div>
</div>
</td>
</tr>
<tr>
<td style="padding:10px;border:none;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">💪 Power Charge</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">Volle Leistung per Klick – Stopp beim Max-SOC.</div>
</div>
</td>
<td style="padding:10px;border:none;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">🌡️ Wärmepumpe</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">Soll-Temperatur + Testlauf zur Kalibrierung.</div>
</div>
</td>
</tr>
<tr>
<td style="padding:10px;border:none;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">🧺 Verbraucher</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">Waschmaschine, Lüftung, Poolpumpe – alles Schaltbare.</div>
</div>
</td>
<td style="padding:10px;border:none;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">🔍 Geräte-Erkennung</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">PVM schlägt Sensoren vor – du bestätigst per Klick.</div>
</div>
</td>
</tr>
<tr>
<td style="padding:10px;border:none;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">📊 Eigene Seite</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">Kein Lovelace: eine komplett eigene, automatisch erstellte Seite.</div>
</div>
</td>
<td style="padding:10px;border:none;background:#16213e;vertical-align:top;">
<div style="background:#1a1a3e;border-radius:10px;padding:12px;">
<div style="color:#41BDF5;font-size:13px;font-weight:600;">🔌 Herstellerunabhängig</div>
<div style="color:#aaaaaa;font-size:12px;margin-top:4px;">Jede HA-Entität steuerbar – auch evcc, openWB, Shelly.</div>
</div>
</td>
</tr>
</table>
<br>
</div>

PVM ist **modular**: Einzelne Funktionen sind optional – es läuft auch mit nur einer Wallbox oder nur einer Wärmepumpe.

### Installation

**Variante 1: Per Button (empfohlen)**

Klick auf den großen Button oben – HACS öffnet sich und installiert PVM direkt.

**Variante 2: Manuell in HACS**

1. **HACS öffnen** → Drei-Punkte-Menü → **„Custom repositories“**.
2. URL: `https://github.com/Dealwirth/PVM` → Typ: **„Integration“**.
3. Nach **„PV Manager“** suchen → **Installieren**.
4. **Home Assistant neu starten**.

**Danach (in Home Assistant)**

1. **Einstellungen → Geräte & Dienste → Integration hinzufügen** → „PV Manager“.
   **Keine Fragen:** Die Installation ist in einem Klick erledigt.
2. PVM erstellt sofort die **„PV Manager“-Seite** in der Seitenleiste – eine komplett
   eigene Oberfläche (kein Lovelace), direkt nutzbar mit Start-Tutorial.
3. Die Start-Seite erklärt dir Schritt für Schritt, wie du **Sensoren abliest** und
   **Geräte hinzufügst**: PVM durchsucht alle deine Integrationen und schlägt passende
   Sensoren/Geräte vor. Du bestätigst nur noch („Ja, das ist meiner“).
4. Danach verwaltest du alles **in der PV-Manager-Seite**: Messungen, Geräte,
   Reihenfolge, Ziele und Einstellungen – inklusive Design-Wechsel zwischen
   ☀️ Sonnenaufgang, 🌿 Natur-frisch und 🌊 Kühl & klar.

### Bedienung

- **Sensoren ablesen** – Kacheln unter ☀️ **Übersicht** zeigen live, was PV erzeugt,
  was das Netz liefert/abnimmt, was das Haus verbraucht und wie viel Überschuss frei ist.
  Antippen öffnet den Verlauf.
- **Geräte hinzufügen** – PVM findet deine Wallbox, Wärmepumpe und Verbraucher selbst
  und schlägt sie dir zum Bestätigen vor (auch per „Jetzt suchen“-Button).
- **Steuerung** – pro Gerät ein Schalter, zwei Start/Stopp-Taster oder Schalter + Leistungs-Limit.
- **Prioritäten** – Geräte mit **▲/▼-Buttons** verschieben: oben = zuerst Strom.
- **Power Charge** – Schalter antippen, Auto lädt mit voller Leistung, Stopp automatisch.
- **Ziele setzen** – Mindest-/Max-SOC und Frist-Ziel (Uhrzeit + Ziel) direkt auf der Seite.
- **WP-Test** – „WP-Test starten“: heizt bis 70 °C, misst und speichert den Verbrauch.
- **Design wechseln** – in 🎨 **Einstellungen** zwischen ☀️ Sonnenaufgang,
  🌿 Natur-frisch und 🌊 Kühl & klar umschalten; jede Gruppe lässt sich separat aufklappen.

> **Kein YAML nötig – alles geht per Klick.**

[⬆️ Zurück zum Inhaltsverzeichnis](#-inhaltsverzeichnis)

---
## 🔄 Funktionsweise

PVM entscheidet **alle 30 Sekunden neu**, wer deinen PV-Überschuss bekommt:

1. **Überschuss messen** – Netz-Sensor (Import/Export) oder PV minus Hausverbrauch, abzüglich kleiner Reserve.
2. **Garantien zuerst** – Power Charge, dringende Frist-Ziele, Mindest-SOC und WP-Notfall laufen nötigenfalls auch mit Netzstrom.
3. **Nach Priorität verteilen** – oberstes Gerät zuerst, Leistungs-Limits und Mindest-Ladeleistung werden beachtet.
4. **Sauber schalten** – Mindest-Schaltzeiten und Hysterese verhindern Flackern; ungültige Werte → letzter gültiger Wert.
5. **Ziele beenden** – Frist oder Max-SOC erreicht, Überschuss weg → Gerät stoppt, Strom geht ans nächste Gerät.

**Ausfallsicher:** Ein Sensorausfall blockiert nichts. Nach 3 Fehlern pausiert die Engine kurz und startet selbstständig neu.

[⬆️ Zurück zum Inhaltsverzeichnis](#-inhaltsverzeichnis)

---
## ❓ Häufige Fragen

| Frage | Antwort |
| :--- | :--- |
| Wird nur mit PV-Überschuss geladen? | Standardmäßig ja. Netzstrom nur für Mindest-SOC, Frist-Ziele oder Power Charge – per Schalter abschaltbar. |
| Welche Wallboxen werden unterstützt? | Alle, die in HA Entitäten haben: Ein Schalter, zwei Start/Stopp-Taster oder Schalter + Leistungs-/Strom-Limit. |
| Gibt es noch einen Setup-Wizard? | Nein – Installation in einem Klick; alles Weitere passiert in der PV-Manager-Seite (Start-Tutorial). |
| Warum lädt mein Auto bei 500 W Überschuss nicht? | Unterhalb der Mindest-Ladeleistung (Standard 1,4 kW) startet PVM bewusst nicht. |
| Was passiert gerade? | Status-Sensoren je Gerät, „PVM Status“ global und Service `pvm.run_self_test`. |
| Fehler melden? | [GitHub Issues](https://github.com/Dealwirth/PVM/issues) mit Log (Filter `pvm`) und Diagnose. |

Weitere Details und Lösungen: [docs/faq.md](docs/faq.md).

[⬆️ Zurück zum Inhaltsverzeichnis](#-inhaltsverzeichnis)

---
## 🤖 KI-Support

Du brauchst Hilfe? Kopiere den Prompt unten (Button oben rechts im Codeblock) in deine KI – sie liest zuerst das Projekt und stellt sich dann als PVM Assistant vor.

```text
Ich brauche Hilfe bei der Home Assistant-Integration „PVM – PV Manager“
(https://github.com/Dealwirth/PVM).

1. Lies zuerst das README und das gesamte Projekt, um es vollständig zu verstehen.
2. PVM ist ein modularer Energiemanager für PV-Überschuss: Er steuert Wallboxen,
   Wärmepumpen und andere Verbraucher.
3. Stell dich als „PVM Assistant“ vor und frage: „Ich bin dein PVM Assistant.
   Wie kann ich dir helfen?“
4. Antworte kurz, klar und verständlich – keine langen Erklärungen.
   Wenn du etwas nicht weißt, frage kurz nach.
```

[⬆️ Zurück zum Inhaltsverzeichnis](#-inhaltsverzeichnis)

---
## 🔧 Für Entwickler

| Thema | Details |
| :--- | :--- |
| **Sprache** | Python 3.11+ |
| **Framework** | Home Assistant Core (Async/Await) |
| **Abhängigkeiten** | Nur HACS – keine externen Libs |
| **Daten** | JSON-Store (`.storage/pvm`), kein YAML |
| **Qualität** | `ruff` + `pytest` + `hassfest` in CI |

**Struktur (Überblick):**

```
custom_components/pvm/
├── engine.py              Prioritäts-Engine (reine Logik)
├── manager.py             Steuerzyklus & Service-Aufrufe
├── config_flow.py         Ein-Klick-Installation (keine Fragen)
├── panel_data.py          Entitäten-Mapping für die Seite
├── websocket.py           WebSocket-Kommandos (get/save/scan)
├── panel.py               Seitenleisten-Panel-Registrierung
├── panel/panel.js         Eigene Oberfläche (HTML/CSS/JS)
├── sensor.py … time.py    Entitäten-Plattformen
└── translations/          de + en
```

👉 Kompletter Dateibaum mit Beschreibungen **aller** Module: [docs/architecture.md](docs/architecture.md)

**Weitere Infos:**

- **Erweiterung** – neue Rollen über Engine + Panel-Dialoge: [docs/development.md](docs/development.md)
- **Code-Stil** – Async/Await, Type Hints, Google-Docstrings.
- **Tests** – `pytest` im `tests/`-Ordner, ohne HA-Installation.
- **PRs** – Branch von `main`, `ruff` + Tests grün, Doku aktualisieren.

[⬆️ Zurück zum Inhaltsverzeichnis](#-inhaltsverzeichnis)

---
## 📚 Dokumentation

- [Installation](docs/installation.md)
- [Konfiguration](docs/configuration.md)
- [FAQ & Fehlerbehebung](docs/faq.md)
- [Architektur & Struktur](docs/architecture.md)
- [Für Entwickler](docs/development.md)

[⬆️ Zurück zum Inhaltsverzeichnis](#-inhaltsverzeichnis)

---
## 📜 Lizenz

MIT – siehe [LICENSE](LICENSE).

---

*Made with ❤️ by Dealwirth*