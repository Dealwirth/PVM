<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:6px">
  <h1 style="margin:0">☀️ PVM – PV Manager</h1>
  <img src="icon.png" alt="PVM-Logo" width="84" height="84" style="border-radius:14px;box-shadow:0 3px 10px rgba(0,0,0,.18)">
</div>

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2025.2.0+-blue.svg)](https://www.home-assistant.io)
[![GitHub Release](https://img.shields.io/badge/version-1.9.6-blue.svg)](https://github.com/Dealwirth/PVM/releases)
[![License](https://img.shields.io/github/license/Dealwirth/PVM)](LICENSE)

**PVM** ist dein intelligenter Energiemanager für Home Assistant. Er verteilt deinen
PV-Überschuss automatisch an Wallboxen, Wärmepumpe, Waschmaschine & Co. – über eine
eigene, klar gestaltete **PVM-Seite** in der Seitenleiste (mit eigenem Logo). Kein YAML, kein
Setup-Wizard: Installieren, öffnen, Geräte per Klick übernehmen – fertig.

<div style="margin:26px 0 8px">
<a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=Dealwirth&repository=PVM&category=integration"
   style="display:block;width:100%;box-sizing:border-box;padding:9px 16px;border-radius:12px;background:#03a9f4;color:#ffffff;text-decoration:none;font-weight:800;font-size:20px;letter-spacing:.4px;text-align:center;border:1px solid #039be5;box-shadow:0 4px 14px rgba(3,169,244,.45);transition:filter .12s ease, box-shadow .12s ease;"
   onmouseover="this.style.filter='brightness(1.08)';this.style.boxShadow='0 6px 20px rgba(3,169,244,.55)'"
   onmouseout="this.style.filter='';this.style.boxShadow=''">
  PVM in HACS
</a>
<em style="font-size:14px;display:block;margin-top:8px">Ein Klick – HACS öffnet sich und installiert PVM.</em>
</div>

---

## 📌 Inhaltsverzeichnis

<div align="center">
<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:820px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">

<a href="#-schnellstart" style="flex:1 1 180px;min-width:150px;padding:12px 10px;background:#16213e;border-radius:12px;color:#41BDF5;text-decoration:none;font-weight:600;">🚀 Schnellstart</a>
<a href="#-funktionen" style="flex:1 1 180px;min-width:150px;padding:12px 10px;background:#16213e;border-radius:12px;color:#41BDF5;text-decoration:none;font-weight:600;">⚡ Funktionen</a>
<a href="#-bedienung" style="flex:1 1 180px;min-width:150px;padding:12px 10px;background:#16213e;border-radius:12px;color:#41BDF5;text-decoration:none;font-weight:600;">🛠️ Bedienung</a>
<a href="#-so-funktioniert-es" style="flex:1 1 180px;min-width:150px;padding:12px 10px;background:#16213e;border-radius:12px;color:#41BDF5;text-decoration:none;font-weight:600;">🔄 So funktioniert es</a>
<a href="docs/faq.md" style="flex:1 1 180px;min-width:150px;padding:12px 10px;background:#16213e;border-radius:12px;color:#41BDF5;text-decoration:none;font-weight:600;">❓ Häufige Fragen</a>
<a href="#-dokumentation" style="flex:1 1 180px;min-width:150px;padding:12px 10px;background:#16213e;border-radius:12px;color:#41BDF5;text-decoration:none;font-weight:600;">📚 Dokumentation</a>
<a href="#-lizenz" style="flex:1 1 180px;min-width:150px;padding:12px 10px;background:#16213e;border-radius:12px;color:#41BDF5;text-decoration:none;font-weight:600;">📜 Lizenz</a>

</div>
<em>Alle Punkte passen sich automatisch an deine Bildschirmbreite an.</em>
</div>

---

## 🚀 Schnellstart

1. **Installieren** – klick oben auf den blauen Button (oder: *HACS → Custom repositories → `https://github.com/Dealwirth/PVM` → Typ „Integration“*) und starte Home Assistant neu.
2. **Aktivieren** – *Einstellungen → Geräte & Dienste → Integration hinzufügen → „PV Manager“*. Keine Fragen, ein Klick genügt.
3. **Loslegen** – öffne die neue **PVM-Seite** in der Seitenleiste. Das Start-Tutorial führt dich Schritt für Schritt durch die Einrichtung.

> 🎯 Ziel erreicht, sobald zwei Dinge stehen: **Energie-Sensoren** (PV + Netz) und **mindestens ein Gerät** (Wallbox, Wärmepumpe, Verbraucher oder Auto). Alles Weitere kannst du jederzeit nachträglich ändern – nichts ist beim Anlegen festgeschrieben.

---

## ⚡ Funktionen

| | | |
|---|---|---|
| ⚡ **Überschuss verteilen**<br><small>Solarstrom zuerst an deine wichtigsten Geräte – du legst die Reihenfolge fest.</small> | 🚗 **E-Autos & Wallboxen**<br><small>Mindest-SOC, Max-SOC, Zeit-Ziele und Power Charge. Die Auto-Erkennung ist zuschaltbar – sonst nutzt PVM die Heimat-Wallbox.</small> | 🌡️ **Wärmepumpe**<br><small>Bei Überschuss bis zur Komfort-Temperatur heizen – mit Notfall-Schutz (Minimum 60 °C gegen Legionellen) und „Nur Ziel-Temperatur“ ohne Ein/Aus.</small> |
| 🧺 **Verbraucher**<br><small>Waschmaschine, Poolpumpe, Lüftung … alles Schaltbare bekommt Überschuss.</small> | 🔍 **Geräte-Erkennung**<br><small>PVM durchsucht deine Integrationen und schlägt passende Sensoren und Geräte vor – du bestätigst per Klick. Gefundene Vorschläge bleiben gespeichert.</small> | 📊 **Statistik & Prognose**<br><small>Leistungs-Charts direkt aus der HA-Historie mit Modi und Einzel-Auswahl plus PV-Prognose (15 Min / 3 h / Tag) – mit eigenem Open-Meteo-API-Schlüssel.</small> |
| 🧲 **Netzbezug & Einspeisung**<br><small>Ein kombinierter Sensor **oder** zwei getrennte Zähler – du entscheidest, PVM rechnet beides korrekt.</small> | 🛡️ **Ausfallsicher**<br><small>Sensorausfälle blockieren nichts; die Engine pausiert kurz und startet von selbst neu.</small> | 🔌 **Herstellerunabhängig**<br><small>Alles, was in HA als Entität existiert, kann PVM steuern – auch evcc, openWB, go-e & Co.</small> |

PVM ist **modular**: Du brauchst nicht alle Funktionen – es läuft auch mit nur einer Wallbox oder nur einer Wärmepumpe.

---

## 🛠️ Bedienung

Die **PV-Manager-Seite** ist deine Zentrale. Ihre Reiter:

- **Erste Schritte** – Status & Mini-Tutorial: zeigt, was noch fehlt, und springt dich dorthin.
- **☀️ Übersicht** – Live-Energiefluss: PV, Haus, Netz(bezug/-einspeisung), Speicher und Überschuss – alles aktuell, jede Sekunde.
- **🔌 Geräte** – Geräte hinzufügen, **bearbeiten** (✏️) oder entfernen (🗑️) – jederzeit, auch nachträglich.
- **⬆️ Reihenfolge** – wer zuerst Überschuss bekommt (oben = zuerst).
- **🔍 Gefunden** – Vorschläge der Auto-Erkennung als aufklappbare Zeilen; das Ergebnis bleibt gespeichert – kein erneutes Suchen nach Neustart nötig.
- **📊 Statistik** – Leistungs-Charts direkt aus der HA-Historie (Fläche/Linie), Modi (Alles, PV, Verbraucher, Wallboxen, Netz) und die PV-Prognose (API-Schlüssel erforderlich – Anleitung in den Einstellungen).
- **🎨 Einstellungen** – Energie-Sensoren (mit ✓-Haken und Detail-Klick), Modus, Reserve, Zeiten und Design – alles aufklappbar.

Die wichtigsten Knöpfe im Überblick:

| Aktion | So geht's |
|---|---|
| Sensor anbinden | *Einstellungen → Energie-Sensoren → „Wählen“* (mit Suchfeld) |
| Gerät anlegen | *Geräte → „Gerät hinzufügen“* – Typ wählen, Steuerung, Sensoren |
| Automatisch finden | *„Automatisch suchen“* – dann unter *Gefunden* per Klick übernehmen |
| Gerät nachträglich ändern | ✏️ auf der Gerätekarte – Typ, Schalter, Sensoren und Ziele sind jederzeit änderbar |
| Manuell voll laden | Power Charge am Auto (Dialog oder Karte) |
| PVM pausieren | *Einstellungen → Steuerung → „Automatik / Manuell“* – im Manuell-Modus misst PVM nur noch |
| Zurück zu HA | „← Home Assistant“ oben rechts öffnet die Seitenleiste wieder |

> ⚙️ Zusätzlich gibt es nützliche Entitäten für Automationen: `select.pvm_mode`, `switch.pvm_auto_…`, `sensor.pvm_status`, `button.pvm_scan` sowie die Services `pvm.power_charge`, `pvm.set_priority`, `pvm.set_deadline`, `pvm.run_self_test` u. a. – Details im [Konfigurations-Handbuch](docs/configuration.md).

---

## 🔄 So funktioniert es

PVM entscheidet alle 30 Sekunden neu, wer deinen PV-Überschuss bekommt:

1. **Überschuss messen** – aus Netz-Sensor (kombiniert **oder** getrennt Bezug/Einspeisung) bzw. PV minus Hausverbrauch, abzüglich kleiner Reserve.
2. **Garantien zuerst** – Power Charge, dringende Zeit-Ziele, Mindest-SOC und WP-Notfall laufen nötigenfalls kurz mit Netzstrom.
3. **Nach Priorität verteilen** – oberstes Gerät zuerst; Leistungs-Limits und Mindest-Ladeleistung werden beachtet.
4. **Sauber schalten** – Mindest-Schaltzeiten verhindern Flackern; ungültige Messwerte halten den letzten Zustand.
5. **Ziele beenden** – Frist oder Max-SOC erreicht → Gerät stoppt, der Strom geht ans nächste Gerät.

Bei **mehreren Autos** (und eingeschalteter „Automatische Auto-Erkennung“)
vergleicht PVM die Ladeleistungen von Autos und Wallboxen und ordnet sie
automatisch zu – lädt nur ein Auto, ist die Zuordnung trivial. Standardmäßig
ist die Erkennung **aus**: Dann nutzt PVM die im Auto gewählte
**Heimat-Wallbox**. Nicht ladende Autos gelten als *unterwegs*.

---

## ❓ Häufige Fragen

| Frage | Kurzantwort |
|---|---|
| Wird nur mit PV-Überschuss geladen? | Ja – Netzstrom fließt nur für Mindest-SOC, Zeit-Ziele oder Power Charge (jeweils abschaltbar). |
| Welche Wallboxen/Wärmepumpen sind unterstützt? | Alles mit HA-Entitäten: Schalter, zwei Taster oder Schalter + Leistungs-Limit. Herstellerunabhängig. |
| Gibt es einen Setup-Wizard? | Nein – ein Klick installiert; alle weiteren Schritte führt die PV-Manager-Seite. |
| Warum startet mein Gerät bei wenig Überschuss nicht? | Unter der Mindest-Ladeleistung (Standard 1,4 kW) schaltet PVM bewusst nicht – das „lohnt“ sich nicht. |
| Etwas funktioniert nicht? | Führe den **Selbsttest** aus (Einstellungen → System) und sieh ins Log (`Filter: pvm`). |

📖 **Alle Fragen & Lösungen** (Sensor-Ausfälle, Taster-Wallboxen, „nichts wird geschaltet“, Auto-Zuordnung u. v. m.): **[docs/faq.md](docs/faq.md)**

---

## 📚 Dokumentation

| Dokument | Inhalt |
|---|---|
| [📦 Installation](docs/installation.md) | Alle Installationswege Schritt für Schritt |
| [🎛️ Konfiguration](docs/configuration.md) | Sensoren, Geräte, Modi und Services im Detail |
| [❓ FAQ & Fehlerbehebung](docs/faq.md) | Antworten auf alle häufigen Fragen |

> 🔧 **Für Entwickler & Fortgeschrittene:** [Architektur & Struktur](docs/architecture.md) und [Entwicklung](docs/development.md) (Tests, Code-Stil, Erweiterungen) – diese Details gehören nicht ins Anwender-Handbuch.

---

## 📜 Lizenz

MIT – siehe [LICENSE](LICENSE).

---

*Made with ❤️ by Dealwirth – Fragen, Ideen oder Fehler? [GitHub Issues](https://github.com/Dealwirth/PVM/issues)*
