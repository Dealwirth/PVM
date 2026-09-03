# Changelog

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.

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
