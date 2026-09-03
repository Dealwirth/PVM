# Konfiguration

Alles wird **ohne YAML** über das **Dashboard** konfiguriert (Installation in
 einem Klick ohne Wizard). Verwaltungs-Dialoge (Messungen, Geräte, gefundene
 Sensoren/Geräte übernehmen) erreichst du aus dem Dashboard heraus über
 **Geräte & Dienste → PV Manager → Optionen** – sie sind bewusst kurz und
 auf einen Zweck beschränkt.

## Energie-Messung

PVM braucht mindestens **einen** der beiden Wege, um den Überschuss zu kennen:

| Sensor | Wofür? | Empfohlen |
| --- | --- | --- |
| **Netz-Sensor** | Import positiv, Export negativ (z. B. Shelly EM, viele Zähler). PVM nutzt den gemessenen Export als echten Überschuss. | ⭐ Am genauesten |
| **Netz-Sensor (nur Einspeisung)** | Sensor, der nur den Export kennt (positiv = Einspeisung). | ⭐ |
| **PV-Leistung** | Erzeugung des Wechselrichters. | Für PV-ohne-Netz-Setups |
| **Hausverbrauch** (optional) | Nur nötig, wenn kein Netz-Sensor vorhanden ist (Überschuss = PV − Haus). | – |

**Einspeise-Reserve** (Nummer „PVM Einspeise-Reserve“): Leistung in Watt, die
PVM als Puffer zurückhält (Standard 100 W). So werden kurzzeitige Wolken oder
Messschwankungen nicht sofort an die Verbraucher weitergereicht.

> **Hinweis:** Ohne Haus-Sensor und ohne Netz-Sensor wird die komplette
> PV-Leistung als Überschuss behandelt – dann sollte der Hausverbrauch klein
> sein oder ein Netz-Sensor nachgerüstet werden.

## Geräte

Jedes Gerät hat eine **Rolle**, eine **Steuerung** und optionale **Sensoren**.

| Rolle | Steuerung | Optionale Sensoren | Besonderheiten |
| --- | --- | --- | --- |
| **Wallbox (E-Auto)** | Schalter an/aus und/oder Leistungs-/Strom-Limit (Nummer) | Ladeleistung, SoC | Mindest-/Max-SOC, Frist-Ziele, Power Charge, Netz-Freigaben |
| **Wärmepumpe** | Schalter (Heizbetrieb erlauben) | Temperatur (Pflicht), Leistung | Soll-Temperatur, Sicherheits-Minimum, Kalibrierungstest |
| **Verbraucher** | Schalter | Leistung | Nennleistung für die Entscheidung |

**Steuerungsarten**

- **Schalter (an/aus):** PVM schaltet die Entität. Die Leistung ist nicht regelbar
  (Gerät läuft mit seiner normalen Leistung oder gar nicht).
- **Schalter + Leistungs-/Strom-Begrenzung:** Zusätzlich setzt PVM einen
  Sollwert an eine Nummern-Entität (z. B. „Max-Strom“ einer Wallbox). Damit kann
  der Überschuss fein verteilt werden. Einheit (`W`, `kW`, `A`, `mA`) und
  Phasenzahl werden beim Hinzufügen abgefragt und bei der Umrechnung
  (Watt ↔ Ampere) verwendet.

**Automatik-Schalter:** Jedes Gerät hat einen Schalter
„**Automatik (Überschuss)**“. Nur wenn er an ist, steuert PVM das Gerät.
Ausgeschaltete, noch laufende Geräte werden sanft gestoppt.

## Prioritäten

Die Reihenfolge der Geräte bestimmt, **wer zuerst Überschuss bekommt**
(1 = höchste Priorität). Ändern kannst du sie im Dashboard-Bereich
**„Prioritäten“** über die ▲/▼-Buttons jedes Geräts oder über den Service
`pvm.set_priority`.

## E-Autos

| Wert | Bedeutung |
| --- | --- |
| **Mindest-SOC** | Garantierter Ladezustand. Ist er unterschritten, lädt PVM (Netzstrom erlaubt) mit begrenzter Leistung, bis der Mindestwert erreicht ist. |
| **Max-SOC** | Ladestopp (Überschuss- und Power-Charge-Laden). |
| **Frist-Ziel-SOC + Frist-Zeit** | „Bis 18:00 sollen 80 % erreicht sein.“ PVM berechnet, wann der Garantie-Ladevorgang spätestens starten muss, und lädt dann nötigenfalls mit Netzstrom. |
| **Power Charge** | Manueller Knopf/Schalter: lädt mit voller Leistung (Netzstrom erlaubt) bis zum Max-SOC und schaltet danach automatisch ab. |
| **Netz für Mindest-SOC / Frist** | Schalter, ob für diese Garantien Netzstrom genutzt werden darf. |

Die Batteriekapazität (kWh) wird benötigt, um aus dem SoC (Prozent) den
Energiebedarf zu berechnen. Der SoC-Sensor aktualisiert oft nur langsam –
PVM berücksichtigt das automatisch und lädt nicht blind weiter.

## Wärmepumpe

- **Soll-Temperatur** (Nummer): Bei Unterschreitung + Überschuss heizt die WP.
- **Netz im Notfall**: Fällt die Temperatur unter das Sicherheits-Minimum
  (Standard 40 °C), heizt die WP auch ohne Überschuss – Frostschutz.
- **WP-Test (Kalibrierung):** Heizt bis zur Zieltemperatur (Standard 70 °C),
  misst alle 10 s Leistung und Temperatur, erkennt und entfernt Störungen
  (z. B. laufende Waschmaschine) und speichert Dauer, Verbrauch und
  Durchschnittsleistung. Start/Stopp über die Buttons im Dashboard oder die
  Services `pvm.wp_test_start` / `pvm.wp_test_abort`.

## Modus (global)

| Modus | Verhalten |
| --- | --- |
| **Auto (Überschuss + Ziele)** | Alles aktiv. |
| **Nur Überschuss** | Kein Netzstrom – auch nicht für Fristen (Fristen dann „best effort“). |
| **Nur Ziele** | Nur Frist-/Mindest-Ziele und Power Charge; kein Überschuss-Laden. |
| **Aus** | Keine automatische Steuerung (laufende Geräte bleiben wie sie sind). |

## Gerätesuche (Auto-Erkennung)

Der Button **„PVM Geräte suchen“** (Dashboard → Einstellungen), der Service
`pvm.scan_devices` oder der automatische Scan beim Start durchsucht die
**Entity- UND Device-Registry** aller Integrationen – inklusive
Hersteller-/Modell-Informationen (z. B. SMA, go-e, openWB, Vaillant).
Gefundene Messungen und Geräte werden **mit Begründung und aktuellem
Messwert** vorgeschlagen; mehrere Treffer fragt PVM ab. Übernehmen geht über
**Optionen → „Gefunden“** – nichts wird ohne deine Bestätigung konfiguriert.

### Steuerungsarten (dynamische Felder)

Pro Gerät wählst du, wie es gesteuert wird – PVM zeigt danach nur die passenden
Felder:

| Steuerung | Felder | Wofür? |
| --- | --- | --- |
| **Ein Schalter (An/Aus)** | 1 Schalter | Meiste Wallboxen/Verbraucher |
| **Zwei Taster (Start/Stopp)** | Start- + Stopp-Taster (+ Leistung nötig) | Wallboxen mit getrennten Tastern |
| **Schalter + Leistungs-/Strom-Limit** (Wallbox) | Schalter + Limit-Entität (A/kW) | Ladung mit PV-Leistungsregelung |

## Dashboard

- Wird direkt nach der Installation automatisch erstellt (auch ohne Geräte)
  und in der Seitenleiste angezeigt; fünf Ansichten: **Start & Tutorial**,
  ☀️ **Übersicht**, 🔌 **Geräte**, ⬆️ **Reihenfolge**, 🎨 **Einstellungen**.
- **Start/Tutorial** erklärt, wie Sensoren abgelesen, Geräte hinzugefügt und
  Dinge eingestellt werden; gefundene Geräte erscheinen dort ebenfalls.
- **Einstellungen** sind in Gruppen mit eigenem Aufklapp-Schalter organisiert
  (Globale Regeln standardmäßig offen, Geräte-Gruppen zugeklappt).
- **3 Designs** per Select umschaltbar: ☀️ Sonnenaufgang (Standard),
  🌿 Natur-frisch, 🌊 Kühl & klar.
- **„Dashboard aktualisieren“** (Button/Service `pvm.rebuild_dashboard`)
  aktualisiert die PVM-Karten; nach Messungs-/Geräte-/Design-Änderungen
  passiert das automatisch (überschreibt dabei eigene Anpassungen an den
  PVM-Karten).

## Services (für Automationen)

| Service | Beschreibung |
| --- | --- |
| `pvm.power_charge` | Power Charge an/aus (`entity_id` + `charge`). |
| `pvm.set_priority` | Priorität setzen (`entity_id` + `position`). |
| `pvm.set_deadline` | Frist-Ziel setzen (`time` + `target_soc`). |
| `pvm.clear_deadline` | Frist-Ziel löschen. |
| `pvm.wp_test_start` / `pvm.wp_test_abort` | WP-Kalibrierungstest. |
| `pvm.scan_devices` | Gerätesuche starten. |
| `pvm.rebuild_dashboard` | Dashboard neu erzeugen. |
| `pvm.run_self_test` | Selbsttest (Meldung mit Problemen). |

**Tipp:** Bei den Services wählst du im Feld „Gerät“ einfach eine beliebige
Entität des gewünschten PVM-Geräts (z. B. dessen Status-Sensor).
