# Konfiguration

Alles wird **ohne YAML** auf der eigenen **PV-Manager-Seite** konfiguriert
(Seitenleiste). Die Installation selbst ist ein Klick ohne Fragen; Messungen,
Geräte, Reihenfolge und Einstellungen verwaltest du ausschließlich dort –
auf einer **eigenständigen Seite**, die PVM selbst mitbringt (kein Lovelace,
keine HA-Dialoge, kein Options-Flow).

Die Seite hat sechs Reiter:

| Reiter | Zweck |
| --- | --- |
| **Erste Schritte** | Mini-Tutorial: Sensoren ablesen → Geräte hinzufügen → einstellen. Zeigt den aktuellen Stand und leitet dich zum nächsten Schritt. |
| **☀️ Übersicht** | Live-Energiefluss: PV, Haus, Netz, Überschuss und jedes Gerät mit aktuellem Wert – animiert und farbcodiert. |
| **🔌 Geräte** | Alle Geräte ansehen, hinzufügen, bearbeiten, entfernen und einzeln steuern. |
| **⬆️ Reihenfolge** | Prioritätenliste per ▲/▼-Buttons (oben = bekommt zuerst Strom). |
| **🔍 Gefunden** | Vorschläge der Auto-Erkennung mit Begründung und Live-Messwert – per Klick übernehmen. |
| **🎨 Einstellungen** | Globale Regeln und Design – aufklappbare Gruppen, Schieberegler für Laien. |

Jede Änderung wird sofort über die PVM-WebSocket-Kommandos gespeichert und
wirkt ab dem nächsten Steuerzyklus (30 s).

## Energie-Messung

PVM braucht mindestens **einen** der beiden Wege, um den Überschuss zu kennen.
Unter **Erste Schritte → Sensoren ablesen** wählst du pro Sensor einfach aus,
ob du ihn hast und welche Entität es ist („habe ich nicht“ ist immer eine
Option – PVM fährt dann mit dem anderen Weg fort):

| Sensor | Wofür? | Empfohlen |
| --- | --- | --- |
| **Netz-Sensor** | Import positiv, Export negativ (z. B. Shelly EM, viele Zähler). PVM nutzt den gemessenen Export als echten Überschuss. | ⭐ Am genauesten |
| **Netz-Sensor (nur Einspeisung)** | Sensor, der nur den Export kennt (positiv = Einspeisung). | ⭐ |
| **PV-Leistung** | Erzeugung des Wechselrichters. | Für PV-ohne-Netz-Setups |
| **Hausverbrauch** (optional) | Nur nötig, wenn kein Netz-Sensor vorhanden ist (Überschuss = PV − Haus). | – |

Die Auswahlfelder akzeptieren **alle passenden Entitätenarten** (Sensor-,
Zähler- und Zahlen-Entitäten) und zeigen verständliche Namen mit Beispielen –
der alte kryptische Fehler „expected (sensor)“ ist damit behoben. Findet PVM
deine Sensoren selbst, erscheinen sie unter **🔍 Gefunden** und du übernimmst
sie mit einem Klick.

**Einspeise-Reserve:** Leistung in Watt, die PVM als Puffer zurückhält
(Standard 100 W). So werden kurzzeitige Wolken oder Messschwankungen nicht
sofort an die Verbraucher weitergereicht. Einstellbar unter **Einstellungen →
Globale Regeln**.

> **Hinweis:** Ohne Haus-Sensor und ohne Netz-Sensor wird die komplette
> PV-Leistung als Überschuss behandelt – dann sollte der Hausverbrauch klein
> sein oder ein Netz-Sensor nachgerüstet werden.

## Geräte

Unter **🔌 Geräte → „Gerät hinzufügen“** öffnet sich ein eigenes, übersichtliches
Formular. Es kennt alle gängigen Geräte und zeigt **nur die Felder, die zu
deiner Auswahl passen** – nichts Kompliziertes nebenher.

| Rolle | Steuerung | Optionale Sensoren | Besonderheiten |
| --- | --- | --- | --- |
| **Wallbox (E-Auto)** | Schalter an/aus, zwei Taster oder Schalter + Leistungs-/Strom-Limit | Ladeleistung, SoC | Mindest-/Max-SOC, Frist-Ziele, Power Charge, Netz-Freigaben |
| **Wärmepumpe** | Schalter (Heizbetrieb erlauben) | Temperatur (Pflicht), Leistung | Soll-Temperatur, Sicherheits-Minimum, Kalibrierungstest |
| **Verbraucher** | Schalter | Leistung | Nennleistung für die Entscheidung |

**Steuerungsarten – du wählst eine, die Felder erscheinen automatisch:**

- **Ein Schalter (An/Aus):** PVM schaltet die Entität. Das Gerät läuft mit
  seiner normalen Leistung oder gar nicht.
- **Zwei Taster (Start/Stopp):** Für Geräte mit getrennten Tastern (z. B.
  manche Wallboxen: ein Taster für Start, einer für Stopp). Dazu wird der
  **Ladeleistungs-Sensor** als Pflichtfeld abgefragt – an ihm erkennt PVM,
  ob das Gerät wirklich läuft, und drückt die Taster nur bei echten
  Zustandswechseln (kein Doppel-Start/-Stopp).
- **Schalter + Leistungs-/Strom-Begrenzung:** Zusätzlich setzt PVM einen
  Sollwert an eine Nummern-Entität (z. B. „Max-Strom“ einer Wallbox). Damit
  kann der Überschuss fein verteilt werden. Einheit (`W`, `kW`, `A`, `mA`) und
  Phasenzahl fragt das Formular ab und rechnet Watt ↔ Ampere selbst um.

**Automatik-Schalter:** Jedes Gerät hat einen Schalter
„**Automatik (Überschuss)**“. Nur wenn er an ist, steuert PVM das Gerät.
Ausgeschaltete, noch laufende Geräte werden sanft gestoppt. Du kannst den
Schalter auch in Home Assistant direkt nutzen – er ist eine normale Entität.

## Prioritäten

Die Reihenfolge der Geräte bestimmt, **wer zuerst Überschuss bekommt**
(1 = höchste Priorität). Im Reiter **⬆️ Reihenfolge** verschiebst du Geräte
mit **▲/▼-Buttons** – das Ergebnis wird sofort gespeichert und animiert
angezeigt. Alternativ geht es über den Service `pvm.set_priority`.

## E-Autos

| Wert | Bedeutung |
| --- | --- |
| **Mindest-SOC** | Garantierter Ladezustand. Ist er unterschritten, lädt PVM (Netzstrom erlaubt) mit begrenzter Leistung, bis der Mindestwert erreicht ist. |
| **Max-SOC** | Ladestopp (Überschuss- und Power-Charge-Laden). |
| **Frist-Ziel-SOC + Frist-Zeit** | „Bis 18:00 sollen 80 % erreicht sein.“ PVM berechnet, wann der Garantie-Ladevorgang spätestens starten muss, und lädt dann nötigenfalls mit Netzstrom. |
| **Power Charge** | Manueller Schalter: lädt mit voller Leistung (Netzstrom erlaubt) bis zum Max-SOC und schaltet danach automatisch ab. |
| **Netz für Mindest-SOC / Frist** | Schalter, ob für diese Garantien Netzstrom genutzt werden darf. |

Die Batteriekapazität (kWh) wird benötigt, um aus dem SoC (Prozent) den
Energiebedarf zu berechnen. Der SoC-Sensor aktualisiert oft nur langsam –
PVM berücksichtigt das automatisch und lädt nicht blind weiter.

## Wärmepumpe

- **Soll-Temperatur:** Bei Unterschreitung + Überschuss heizt die WP.
- **Netz im Notfall:** Fällt die Temperatur unter das Sicherheits-Minimum
  (Standard 40 °C), heizt die WP auch ohne Überschuss – Frostschutz.
- **WP-Test (Kalibrierung):** Heizt bis zur Zieltemperatur (Standard 70 °C),
  misst alle 10 s Leistung und Temperatur, erkennt und entfernt Störungen
  (z. B. laufende Waschmaschine) und speichert Dauer, Verbrauch und
  Durchschnittsleistung. Start/Stopp über die Buttons im Geräte-Dialog oder
  die Services `pvm.wp_test_start` / `pvm.wp_test_abort`.

## Modus (global)

Der Betriebsmodus sitzt oben auf der Seite (und existiert zusätzlich als
Entität `select.pvm_mode`):

| Modus | Verhalten |
| --- | --- |
| **Auto (Überschuss + Ziele)** | Alles aktiv. |
| **Nur Überschuss** | Kein Netzstrom – auch nicht für Fristen (Fristen dann „best effort“). |
| **Nur Ziele** | Nur Frist-/Mindest-Ziele und Power Charge; kein Überschuss-Laden. |
| **Aus** | Keine automatische Steuerung (laufende Geräte bleiben wie sie sind). |

## Gerätesuche (Auto-Erkennung)

Beim Start sucht PVM automatisch einmal nach passenden Sensoren und Geräten;
jederzeit wiederholbar über den Button **„Jetzt suchen“** (Reiter **🔍 Gefunden**)
oder den Service `pvm.scan_devices`. Die Suche durchsucht die **Entity- UND
Device-Registry** aller Integrationen – inklusive Hersteller-/Modell-
Informationen (z. B. SMA, go-e, openWB, Vaillant). Gefundene Messungen und
Geräte werden **mit Begründung und aktuellem Messwert** vorgeschlagen; bei
mehreren Treffern fragt PVM nach. Übernehmen heißt: Klick auf „Übernehmen“ –
bei Geräten öffnet sich das **vorausgefüllte Formular** zum Bestätigen.
Nichts wird ohne deine Bestätigung konfiguriert.

## Design & Darstellung

- Unter **🎨 Einstellungen → Design** wechselst du zwischen drei Designs:
  ☀️ **Sonnenaufgang** (Standard, warme Gelb-/Orange-Töne), 🌿 **Natur-frisch**
  (Grün) und 🌊 **Kühl & klar** (Blau). Der Wechsel gilt sofort.
- Auch als Entität vorhanden: `select.pvm_theme` – nützlich für Automatisierungen
  (z. B. abends automatisch das Abend-Design).
- Die Übersichts-Seite zeigt einen **animierten Energiefluss** (PV → Haus →
  Netz → Geräte) mit Live-Werten und Statusfarben; jede Kachel ist verlinkt
  (keine kryptischen IDs, sondern klickbare Namen).

## Services (für Automationen)

| Service | Beschreibung |
| --- | --- |
| `pvm.power_charge` | Power Charge an/aus (`entity_id` + `charge`). |
| `pvm.set_priority` | Priorität setzen (`entity_id` + `position`). |
| `pvm.set_deadline` | Frist-Ziel setzen (`time` + `target_soc`). |
| `pvm.clear_deadline` | Frist-Ziel löschen. |
| `pvm.wp_test_start` / `pvm.wp_test_abort` | WP-Kalibrierungstest. |
| `pvm.scan_devices` | Gerätesuche starten. |
| `pvm.rebuild_dashboard` | Seite in der Seitenleiste neu registrieren (nach Problemen). |
| `pvm.run_self_test` | Selbsttest (Meldung mit Problemen). |

**Tipp:** Bei den Services wählst du im Feld „Gerät“ einfach eine beliebige
Entität des gewünschten PVM-Geräts (z. B. dessen Status-Sensor).
