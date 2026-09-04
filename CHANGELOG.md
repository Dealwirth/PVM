# Changelog

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.

## [1.3.1] – 2026-09-04

### Behoben / Verbessert
- **Beim Löschen der Integration wird alles automatisch entfernt:** Die eigene
  PV-Manager-Seite verschwindet aus der Seitenleiste (inkl. altem
  Lovelace-Dashboard), die gespeicherte Konfiguration und die
  PVM-Benachrichtigungen werden gelöscht – kein verwaister Eintrag mehr.

## [1.3.0] – 2026-09-04

### Behoben
- **„Geräte können nicht hinzugefügt werden / es lädt nicht weiter“:** Die
  Benachrichtigungen nutzten das in HA 2024.9 entfernte `hass.components`
  (`persistent_notification`). Dadurch schlug die automatische Gerätesuche
  und das Neuladen nach dem Speichern fehl. Jetzt über den offiziellen
  `persistent_notification`-Service – Scan, Übernehmen und Speichern laufen
  wieder zuverlässig durch.
- **Einheiten-Fehler:** Leistungssensoren in `kW`/`mW` (z. B. SolarNet, viele
  Wallboxen) wurden als Watt interpretiert – Überschuss und Zuordnungen waren
  um den Faktor 1000 falsch. Alle Leistungswerte werden jetzt einheiten-korrekt
  in Watt umgerechnet (Backend und Seite).
- Speichern löst keinen „hängenden“ Zustand mehr aus: Die Seite wartet nach
  dem Speichern aktiv, bis die neue Konfiguration geladen ist.

### Hinzugefügt
- **🚗 Autos (E-Autos) als eigene Geräte:** Akkustand (SoC) und aktuelle
  Ladeleistung werden überwacht. PVM ordnet jedes Auto **vollautomatisch**
  der passenden Wallbox zu – Vergleich der Ladeleistungen (eine Wallbox, ein
  Auto → trivial; mehrere → ähnlichste Leistung). Autos, die nicht laden,
  gelten als **unterwegs**; der Status „lädt an Wallbox … / unterwegs“
  erscheint live auf der Seite und als Sensor (`pvm_car_status_*`).
- **Mehr Energiesensoren:** getrennter Netzbezug- und Einspeisung-Sensor,
  Speicher-Leistung und Speicher-SoC – jeweils optional und einzeln
  abwählbar; neue Rollen in der automatischen Erkennung, Speicher-Knoten im
  Energiefluss-Diagramm.
- **Live-Aktualisierung für alle Daten:** Die Seite abonniert
  `state_changed`-Events über WebSocket und aktualisiert zusätzlich jede
  Sekunde – Energiefluss-Diagramm, Gerätekarten, Auto-Zuordnung und Status.
- **„← Home Assistant“-Button** im Kopf: öffnet die Seitenleiste wieder und
  führt zurück zur HA-Startseite (nicht irgendwohin).
- **Design „🏠 Home Assistant“** (neuer Standard): übernimmt automatisch
  Farben, Karten-Ecken und Schatten deines HA-Themes (hell/dunkel); die
  drei festen Stimmungen bleiben als Alternative erhalten.

## [1.2.0] – 2026-09-03

### Hinzugefügt – eigene PV-Manager-Seite (kein Lovelace mehr)
- **Komplett selbst gebaute Oberfläche** (`panel/panel.js`, ~1.900 Zeilen HTML/CSS/JS):
  ersetzt das Lovelace-Dashboard vollständig durch eine eigene Seitenleisten-Seite
  (Mechanik wie HACS: Custom-Panel mit `embed_iframe`, statische Dateien ohne Cache).
- Sechs Reiter: **Erste Schritte** (Mini-Tutorial), **☀️ Übersicht** (animierter
  Energiefluss PV → Haus → Netz → Geräte), **🔌 Geräte**, **⬆️ Reihenfolge**,
  **🔍 Gefunden** (Vorschläge mit Begründung + Live-Wert), **🎨 Einstellungen**
  (aufklappbare Gruppen, Schieberegler, Design-Wechsel mit Animation).
- **Eigene Geräte-Dialoge**: Geräte hinzufügen/bearbeiten/entfernen läuft komplett
  in der Seite – dynamische Felder je Steuerungsart, keine HA-Formulare.
- WebSocket-Kommandos `pvm/get_config`, `pvm/save_config`, `pvm/scan`,
  `pvm/list_entities` für die Seite; jede Speicherung wird validiert.
- Altes Lovelace-Dashboard (`pvm-dashboard`) wird beim ersten Start automatisch
  entfernt; kein Options-Flow und kein Dashboard-Builder/Creator mehr im Code.
- Alle Entitäten bleiben normale HA-Entitäten (für Automationen nutzbar).

### Behoben
- Kryptische Entity-IDs/Nummern in „Links“: Die Seite verlinkt über das
  Entitäten-Mapping (unique_id → entity_id) und zeigt verständliche Namen.
- „expected (sensor)“-Fehler endgültig beseitigt: Auswahlfelder der Seite
  akzeptieren alle passenden Entitätenarten.

## [1.1.0] – 2026-09-03

### Geändert (Dashboard-Zentrale statt Setup-Wizard)
- Kein Installations-Wizard mehr: PVM wird in **einem Klick ohne Fragen** eingerichtet.
- Alles Weitere läuft im **Dashboard**: Start-/Tutorial-Ansicht (Sensoren ablesen, Geräte hinzufügen, Einstellungen), Übersicht, Geräte, Reihenfolge, Einstellungen.
- **Stark verbesserte Auto-Erkennung**: durchsucht Entity- UND Device-Registry aller Integrationen, nutzt Hersteller-/Integrations-Signale (SMA, go-e, openWB, Vaillant …), liefert Kandidaten mit Begründung und fragt bei mehreren Treffern nach.
- **Hybrid-Verwaltung**: Gefundene Sensoren/Geräte werden im Dialog mit Live-Messwert bestätigt und übernommen; manuelle Auswahl bleibt möglich.
- **3 umschaltbare Designs** (☀️ Sonnenaufgang = Standard, 🌿 Natur-frisch, 🌊 Kühl & klar) über einen Design-Select im Dashboard.
- **Steuerung per zwei Tastern** (Start/Stopp) für Wallbox/Wärmepumpe/Verbraucher; Zustand wird über die Ladeleistung erkannt.
- Einstellungen im Dashboard als **aufklappbare Gruppen** (Globale Regeln + je Gerät) mit Schiebereglern; neue Regler (Zykluszeit, Mindestzeiten, Leistungsgrenzen, Notfall-Temperatur).
- **Fehlerfix** „expected (sensor)“: Mess-/Limit-Felder akzeptieren jetzt alle sinnvollen Entitätenarten (sensor/number/input_number, Taster button/switch) mit verständlichen deutschen Meldungen.
- Setup-Status-Sensor (start → messungen → bereit) für das Tutorial.

### Behoben
- Prüfung im Selbsttest berücksichtigt Zwei-Taster-Steuerung.

## [1.0.0] – 2026-09-03

### Hinzugefügt
- Kompletter Neuaufbau der Integration – stabil, getestet und ohne YAML.
- Setup-Wizard mit automatischer Geräteerkennung (Vorschläge werden bestätigt, nichts wird ohne Nutzer angelegt).
- Prioritätenliste mit ▲/▼-Buttons im automatisch erstellten Dashboard.
- PV-Überschussverteilung an Wallboxen, Wärmepumpen und Verbraucher (beliebige HA-Entitäten).
- E-Auto-Laden: Mindest-SOC, Max-SOC, Frist-Ziele („bis 18:00 auf 80 %“) und Power Charge.
- Netzstrom-Verhalten steuerbar (Mindest-SOC/Fristen/Modus „Nur Überschuss“).
- Wärmepumpen-Steuerung mit Soll-/Sicherheitstemperatur und Kalibrierungstest (Aufheizen bis 70 °C, Störungserkennung, Verbrauchsmessung).
- Automatische Dashboard-Erstellung über den HA-eigenen Lovelace-Speicher (idempotent, mit Rebuild-Button/-Service).
- Persistente Konfiguration im JSON-Store, Wiederanlauf-sicher.
- Services für Automationen (Power Charge, Ziele, Priorität, Scan, WP-Test, Selbsttest, Dashboard-Rebuild).
- Diagnose-Export und `run_self_test`-Service.
- Fehlertoleranz: letzte gültige Messwerte, Timeouts, Engine-Neustart, Antiflackern (Mindest-Ein-/Ausschaltzeiten), Hysterese.
- Deutsche + englische Übersetzungen, Dokumentation (`docs/`) und README.
- CI mit hassfest, ruff und pytest (Python 3.12/3.13).

### Behoben (gegenüber früherem Stand)
- Setup-Wizard öffnet zuverlässig und führt vollständig durch.
- Dashboard-Erstellung implementiert (Lovelace-Storage-API statt Platzhalter).
- Keine fehlenden Imports mehr (durch `ruff`/Tests abgesichert).
- Prioritäten werden dauerhaft gespeichert.
- Auto-Erkennung führt echte Vorschläge aus und blockiert nie die Einrichtung.

### Bekannte Einschränkungen
- Die Steuerung erfolgt über Schalter- und Nummern-Entitäten (keine herstellerspezifischen
  Service-Profile – siehe `docs/development.md` für den Erweiterungspunkt).
- Ein echtes „Drag & Drop“ im Dashboard ist mit HA-Standardkarten nicht möglich;
  Prioritäten werden über ▲/▼-Buttons verschoben.
