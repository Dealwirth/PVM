# ☀️ PVM – PV Manager

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.2.0+-blue.svg)](https://www.home-assistant.io)
[![GitHub Release](https://img.shields.io/github/v/release/Dealwirth/PVM)](https://github.com/Dealwirth/PVM/releases)
[![License](https://img.shields.io/github/license/Dealwirth/PVM)](LICENSE)

**PVM** ist dein intelligenter Energiemanager für Home Assistant. Er verteilt deinen PV-Überschuss automatisch an Wallboxen, Wärmepumpe, Waschmaschine und Co. – basierend auf einer **Prioritätenliste**, die du per Drag & Drop festlegst.

<p align="center">
  <a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=Dealwirth&repository=PVM&category=integration" style="display: block; width: 100%; text-align: center;">
    <img src="https://img.shields.io/badge/Integration_hinzufügen-41BDF5?style=for-the-badge&logo=homeassistant&logoColor=white" alt="Integration hinzufügen" style="width: 100%; max-width: 100%; height: auto;">
  </a>
  <br>
  <em>Klick auf den Button – HACS öffnet sich automatisch.</em>
</p>

<br>

<p align="center">
  <img src="https://via.placeholder.com/800x450/1a1a2e/ffffff?text=PVM+Dashboard+Preview" alt="PVM Dashboard Preview" width="800" style="max-width: 100%; height: auto; border-radius: 12px;">
  <br>
  <em>Das PVM-Dashboard – sauber, übersichtlich und sofort einsatzbereit.</em>
</p>

---

## 📌 Inhaltsverzeichnis

- [🚀 Schnellstart](#schnellstart)
- [🤖 KI-Support](#ki-support)
- [🔧 Für Entwickler](#für-entwickler)
- [📜 Lizenz](#lizenz)

---

## 🚀 Schnellstart

### Was kann PVM?
PVM ist ein **modulares System** – du musst nicht alle Funktionen nutzen. Es funktioniert genauso gut, wenn du nur eine Wallbox hast oder nur eine Wärmepumpe. Je nachdem, welche Geräte du in Home Assistant integriert hast, stehen dir entsprechende Funktionen zur Verfügung.

- **Automatische PV-Überschussverteilung** an alle deine Verbraucher.
- **E-Auto-Laden** mit Mindestreichweite, 80%-Limit und Zeit-Zielen (z.B. "bis 18 Uhr voll").
- **Wärmepumpen-Steuerung** inkl. automatischem Testlauf zur Verbrauchsmessung.
- **Waschmaschine, Lüftung, Poolpumpe** – alles, was du mit Home Assistant schalten kannst.
- **Fertiges Dashboard** – wird bei Installation automatisch erstellt.

### Installation

#### Variante 1: Per Button (empfohlen)
Klicke auf den großen Button oben – HACS öffnet sich automatisch und du kannst die Integration direkt installieren.

#### Variante 2: Manuell in HACS
1. **HACS öffnen** → Drei-Punkte-Menü → **"Custom repositories"**.
2. URL eingeben: `https://github.com/Dealwirth/PVM` → Typ: **"Integration"**.
3. In HACS nach **"PV Manager"** suchen → **Installieren**.
4. **Home Assistant neustarten**.
5. Der **Setup-Wizard** öffnet sich automatisch – einfach den Anweisungen folgen.
6. **Fertig!** Das Dashboard "PV Manager" erscheint in deiner Seitenleiste.

### Bedienung
- **Prioritätenliste**: Ziehe die Geräte per Drag & Drop in die gewünschte Reihenfolge.
- **Power Charge**: Klick auf den roten Button – dein Auto lädt mit voller Leistung.
- **Ziele setzen**: Gib eine Uhrzeit und einen Zielwert ein (z.B. 80 % oder 100 km).
- **WP-Test**: Klick auf "Test starten" – die WP heizt einmal auf 70 °C hoch und misst den Verbrauch.

> **Du musst kein YAML schreiben. Alles geht per Klick.**

---

## 🤖 KI-Support

Du brauchst Hilfe bei der Installation oder Einrichtung? Kopiere den folgenden Prompt in deine KI. Sie wird sich zuerst das gesamte Projekt auf GitHub anschauen und sich dann als PVM Assistant vorstellen.

**So funktioniert es:**
1. Klicke auf den Kopierknopf unter dem Prompt.
2. Füge den Prompt in deine KI ein.
3. Die KI fragt dich nach deinem konkreten Problem.
4. Gemeinsam findet ihr eine Lösung.

<div style="background: #f0f0f0; padding: 15px; border-radius: 8px; border: 1px solid #ccc; position: relative; margin: 10px 0;">
  <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 14px; color: #333;" id="ki-prompt">
Ich brauche Hilfe bei der Home Assistant-Integration "PVM – PV Manager" von GitHub (https://github.com/Dealwirth/PVM).

Bitte lies dir zuerst das README und das gesamte Projekt durch, um es vollständig zu verstehen.

Die Integration ist ein modularer Energiemanager für PV-Überschuss. Sie kann Wallboxen, Wärmepumpen und andere Verbraucher steuern.

Stell dich als "PVM Assistant" vor und frage mich: "Ich bin dein PVM Assistant. Wie kann ich dir helfen?"
Antworte danach immer kurz, klar und verständlich. Keine langen Erklärungen. Wenn du etwas nicht weißt, frage einfach kurz nach.
  </pre>
  <button onclick="navigator.clipboard.writeText(document.getElementById('ki-prompt').textContent)" style="position: absolute; top: 8px; right: 8px; background: #41BDF5; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: bold;">📋 Prompt kopieren</button>
</div>

---

## 🔧 Für Entwickler

| Thema | Details |
| :--- | :--- |
| **Sprache** | Python 3.11+ |
| **Framework** | Home Assistant Core (Async/Await) |
| **Abhängigkeiten** | HACS (für Installation), keine weiteren externen Libs |
| **Daten** | Alle Konfigurationen als `input_*`-Entitäten gespeichert |
| **Erweiterung** | Neue Gerätetypen können über die `DEVICE_TYPES`-Registry hinzugefügt werden |

### Neues Gerät hinzufügen

1. Erstelle eine neue Datei im Ordner `custom_components/pvm/device_types/`.
2. Definiere die Klasse (erbt von `BaseDevice`).
3. Implementiere die Methoden:
   - `async_get_power()` – aktuelle Leistung abrufen.
   - `async_set_power(value)` – Leistung setzen (falls regelbar).
   - `async_turn_on()` / `async_turn_off()` – Ein-/Ausschalten.
4. Registriere das Gerät in der `DEVICE_TYPES`-Registry in `const.py`.

### Wichtige Dateien

| Datei | Zweck |
| :--- | :--- |
| `config_flow.py` | Setup-Wizard & Konfiguration |
| `const.py` | Konstanten, Registry, Standardwerte |
| `sensor.py` | Sensoren für PV, WP, Verbraucher |
| `switch.py` | Schalter für Power Charge, WP-Test |
| `device_types/base.py` | Basis-Klasse für alle Geräte |
| `device_types/wallbox.py` | Wallbox-Logik inkl. Auto-Zuordnung |
| `device_types/wärmepumpe.py` | WP-Logik inkl. Test-Modus |

### Code-Stil
- **Async/Await** für alle I/O-Operationen.
- **Type Hints** für alle Funktionen.
- **Docstrings** in Google-Style (kurz, präzise).
- Keine externen Abhängigkeiten außer Home Assistant Core.

### Testen
- Lokale Tests mit `pytest` (Tests im `tests/`-Ordner).
- CI/CD über GitHub Actions (siehe `.github/workflows/validate.yml`).

### Pull Requests
- Branche von `dev` abzweigen.
- Änderungen dokumentieren (in dieser README, falls relevant).
- Sicherstellen, dass alle Tests durchlaufen.

---

## 📜 Lizenz
MIT – siehe [LICENSE](LICENSE).

---

<p align="center">
  <sub>Made with ❤️ by Dealwirth</sub>
</p>