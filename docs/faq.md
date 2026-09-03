# FAQ & Fehlerbehebung

## Das Dashboard „PV Manager“ fehlt in der Seitenleiste

1. Öffne **Einstellungen → Geräte & Dienste → PV Manager**.
2. Dort gibt es einen Button/Service **„Dashboard aktualisieren“**
   (`pvm.rebuild_dashboard`).
3. Falls weiterhin nichts passiert: **Home Assistant neu starten** und nochmals
   ausführen. PVM versucht die Erstellung beim Start automatisch mehrfach;
   Details stehen im Log (`Logs → pvm`).

> Das Dashboard wird wie HA-interne Dashboards im `.storage`-Bereich abgelegt
> (`lovelace_dashboards`, `lovelace.pvm-dashboard`). Es verwendet nur
> Standard-Karten – es ist keine YAML- oder Custom-Card-Konfiguration nötig.

## Es wird nichts geschaltet

Prüfe in dieser Reihenfolge:

1. **Modus** (`select.pvm_mode`): steht er auf „Auto“ oder „Nur Überschuss“?
2. Ist der **Automatik-Schalter** des Geräts an?
3. Zeigt der Sensor **„PVM Überschuss (verfügbar)“** einen Wert > 0?
   - Falls „0“: Liegt **echter Export** vor (Netz-Sensor negativ)? Die
     **Einspeise-Reserve** ist vielleicht zu hoch eingestellt.
4. Ist der Sensor des Geräts (Temperatur/SoC) vorhanden und aktuell?
   - Ohne gültigen SoC/Temperatur-Wert startet PVM **absichtlich nicht**
     (Schutz vor falschen Entscheidungen).
5. Läuft der Status-Sensor des Geräts auf „wartet“? Dann gab es noch keine
   Entscheidung – Log ansehen (`pvm`).

## PVM zieht kurz Strom aus dem Netz

Das ist in drei Fällen gewollt:

- **Mindest-SOC** wird geladen (Schalter „Netz für Mindest-SOC“).
- Ein **Frist-Ziel** ist dringend (Schalter „Netz für Frist-Ziel“).
- **Power Charge** ist aktiv.

Dazu kommt eine kleine **Mindest-Einschaltdauer** (Standard 120 s): Wird der
Überschuss direkt nach dem Einschalten weniger, bleibt das Gerät kurz an, statt
zu flackern. In „Nur Überschuss“ oder mit abgeschalteten Netz-Freigaben zieht
PVM **nie** Netzstrom für den Überschuss-Betrieb.

## Das Auto lädt nicht bis 80 % über den Überschuss

- Prüfe den **Max-SOC** des Autos (Standard 80 %) – darüber wird nie geladen.
- Reicht der Überschuss nicht für die **Mindest-Ladeleistung** der Wallbox
  (Standard 1,4 kW), schaltet PVM nicht an – zu wenig Strom „lohnt“ sich nicht.
- Der SoC-Sensor muss regelmäßig aktualisieren; ist er älter als ~30 Minuten,
  geht PVM auf Nummer sicher und wartet.

## „WP-Test“ startet nicht oder endet sofort

- Der **Temperatur-Sensor** muss konfiguriert sein (Pflicht für den Test).
- Ist die Temperatur bereits über der Zieltemperatur (Standard 70 °C), endet der
  Test sofort mit „Ziel erreicht“ – korrekt so.
- Keine Leistung gemessen? Dann fehlt der Leistungssensor; Dauer und Temperatur
  werden trotzdem protokolliert.

## Nach einem Neustart sind Einstellungen weg

Die Konfiguration liegt im JSON-Store von HA (`.storage/pvm`). Falls sie wirklich
fehlt, war der Store nicht schreibbar (z. B. Berechtigungen oder abgebrochener
Neustart) – die Integration startet dann mit sicheren Standardwerten neu.
Entitäten behalten ihre IDs über die Entitäts-Registrierung.

## Sensoren/Entitäten haben unerwartete Namen

PVM erzeugt Entitäten mit deutschen Anzeigenamen; die automatisch vergebenen
`entity_id`s können dadurch Umlaute enthalten. Du kannst jede Entität in HA
umbenennen (Entität → ⚙ → „Entitäts-ID“). PVM funktioniert mit der umbenannten
ID genauso (Speicherung über eindeutige IDs, nicht über Namen).

## Welche Sensoren braucht PVM wirklich?

- Mindestens **einen** Überschuss-Weg: Netz-Sensor **oder** (PV + Haus).
- Pro Gerät: einen **Schalter**. Empfohlen: Leistungs-Sensor.
- E-Auto: **SoC-Sensor** (sonst kein automatisches Laden mit SOC-Grenzen).
- Wärmepumpe: **Temperatur-Sensor**.

Fehlende optionale Sensoren sind kein Problem – PVM überspringt das Gerät dann
einfach und meldet es im Status-Sensor/Log.

## Wie kann ich Fehler melden?

1. `pvm.run_self_test` ausführen und die Meldung lesen.
2. Logs: **Einstellungen → System → Logs**, Filter `pvm`.
3. Diagnose herunterladen: **PV Manager → ⚙ → Diagnose**.
4. Issue mit Log + Diagnose auf GitHub öffnen.

## Funktioniert PVM mit meiner Hardware (evcc, openWB, go-e, …)?

PVM ist **herstellerunabhängig**: Es steuert beliebige Entitäten in Home
Assistant (Schalter und optional Leistungs-/Strom-Nummer). Wenn deine Wallbox,
Wärmepumpe oder Steckdose in HA als Entität sichtbar ist, kann PVM sie steuern –
auch dann, wenn die eigentliche Steuerung über eine andere Integration
(z. B. evcc, openWB, Shelly) läuft. Die Geräte-Erkennung sucht nach typischen
Namen/device_class-Werten und schlägt passende Sensoren vor; die Zuordnung
bestätigst du selbst.
