# Konfiguration

Alles wird **ohne YAML** über den Setup-Wizard, die Options-Seite
(**Geräte & Dienste → PV Manager → Optionen**) und das Dashboard konfiguriert.

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

Der Button **„PVM Geräte suchen“** (Dashboard → Einstellungen) oder der Service
`pvm.scan_devices` durchsucht Home Assistant nach passenden Sensoren
(Wallboxen, SoC, Wärmepumpen, PV/Netz) und zeigt Vorschläge als Benachrichtigung.
Übernehmen kannst du sie in den **Optionen** (Gerät hinzufügen – die Felder sind
dann vorbefüllt). Nichts wird jemals ohne deine Bestätigung konfiguriert.

## Dashboard

- Wird bei der Einrichtung automatisch erstellt und in der Seitenleiste angezeigt.
- Zeigt: Übersicht (PV, Netz, Haus, Überschuss, Verlauf), Prioritäten
  (▲/▼), Geräte (SoC-/Temperatur-Anzeige, Ziele, Buttons) und Einstellungen.
- **„Dashboard aktualisieren“** (Button/Service `pvm.rebuild_dashboard`) erzeugt
  die PVM-Karten nach Geräte-Änderungen neu (überschreibt dabei eigene
  Anpassungen an den PVM-Karten).

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
