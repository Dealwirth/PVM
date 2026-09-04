# FAQ & Fehlerbehebung

> 📖 **PV Manager – Dokumentation** · [⬅️ Zurück zum README](../README.md) · [Konfiguration](configuration.md)

## Meine Wallbox hat zwei getrennte Taster (Start/Stopp)

Wähle beim Gerät die Steuerungsart **„Zwei Taster (Start/Stopp)“** und ordne die
beiden Taster-Entitäten zu. PVM braucht dann zusätzlich den
**Ladeleistungs-Sensor** (Pflicht), um zu erkennen, ob das Laden läuft – und
drückt die Taster nur bei echten Zustandswechseln (kein Doppel-Start/-Stopp).

## Meine Wärmepumpe hat keinen Schalter – nur eine Soll-Temperatur

Wähle beim Gerät die Steuerungsart **„Nur Ziel-Temperatur (kein Ein/Aus)“**
und ordne die Ziel-Temperatur-Entität zu (eine Nummern-Entität in °C). PVM
stellt dann bei genügend Überschuss die **„Ziel bei Überschuss“**-Temperatur
und bei zu wenig Überschuss wieder die normale Soll-Temperatur ein. Die
Geräte-Erkennung schlägt diese Art automatisch vor, wenn sie eine
einstellbare Temperatur findet.

## Meine Wallbox zeigt keinen Akku-Stand mehr

Der Akku-Stand gehört jetzt zum **Auto**, nicht zur Wallbox – die
Wallbox-Karte zeigt nur Leistung, zugeordnetes Auto und Ziel. Ist ein
Auto mit SoC-Sensor angelegt, siehst du den Akku auf der Auto-Karte. Ohne
SoC-Sensor zeigt PVM gar keine Akku-Leiste an (statt „–“ zu erfinden).

## Fehler „expected (sensor)“ beim Einrichten

Dieser kryptische Hinweis kam früher von zu eng gefassten Entitäten-Feldern.
Inzwischen akzeptieren alle Messfelder **alle passenden Entitätenarten**
(Sensor-, Zähler- und Zahlen-Entitäten), Limit-Felder `number`/`input_number`
und Taster `button`/`switch`. Falls doch einmal ein Hinweis erscheint, steht
immer eine verständliche deutsche Meldung dabei (z. B. „Bitte wähle einen
Start- und einen Stopp-Taster“).

## Wie wechsle ich das Design?

Auf der PV-Manager-Seite unter 🎨 **Einstellungen → Design** zwischen
☀️ Sonnenaufgang (Standard), 🌿 Natur-frisch und 🌊 Kühl & klar umschalten –
die Seite übernimmt das Design sofort. Alternativ gibt es die Entität
`select.pvm_theme` (z. B. für Automatisierungen).

## Die PV-Manager-Seite fehlt in der Seitenleiste

1. Öffne **Einstellungen → Geräte & Dienste → PV Manager** – ist der Eintrag
   wirklich da („1 Gerät/Entitäten“)? Falls nicht, Integration einmal
   **entfernen und neu hinzufügen** (ein Klick, keine Fragen).
2. Starte den Service **„Seite aktualisieren“** (`pvm.rebuild_dashboard`) –
   er registriert die Seitenleisten-Seite neu.
3. Falls weiterhin nichts passiert: **Home Assistant neu starten** und die
   Browser-Seite einmal neu laden (Strg+F5). PVM versucht die Registrierung
   beim Start automatisch; Details stehen im Log (`Logs → pvm`).

> Die Seite ist ein eigenes Seitenleisten-Panel (`/pvm`) mit komplett
> selbst gebauter Oberfläche – kein Lovelace-Dashboard, kein YAML. Ein
> früher (vor 1.2.0) erzeugtes Lovelace-Dashboard wird beim ersten Start
> automatisch entfernt.

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

## Die Wärmepumpe bleibt zu kalt (Legionellen-Schutz)

- Prüfe das **Notfall-Minimum** der Wärmepumpe: Standard **60 °C**. Darunter
  darf das Wasser nicht fallen – PVM heizt zur Not auch mit Netzstrom, damit
  keine Bakterien entstehen.
- Der **Temperatur-Sensor** muss korrekt verbunden sein und regelmäßig
  aktualisieren – nur dann kann PVM das Minimum überwachen.
- Beim Einstellen zeigt dir der **Zonen-Regler** farbig, ab wann es zu kalt
  (unter 55 °C) bzw. unnötig heiß (über 70 °C) wird.

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

## Geräte lassen sich nicht hinzufügen oder die Seite „hängt“

PVM speichert Änderungen jetzt **ohne Wartezeit** und lädt neue Geräte im
Hintergrund nach – ein Hängen gehört damit der Vergangenheit an. Falls die
Seite trotzdem einmal nicht weiterlädt:

1. Seite im Browser neu laden (**Strg+F5**).
2. Warten, bis die Integration neu geladen ist (oben rechts im Browser kurz
   „Verbindung getrennt“ ist normal) – die Seite versucht es automatisch erneut.
3. Selbsttest ausführen und das Log prüfen (`Filter: pvm`).
4. Integration einmal **entfernen und neu hinzufügen** – die gespeicherte
   Konfiguration bleibt beim normalen Neustart erhalten.

## Netzbezug und Einspeisung sind getrennte Zähler (SolarNet & Co.)

Perfekt – das ist der Normalfall für SolarNet & ähnliche Systeme. Wähle auf der
PV-Manager-Seite unter **Einstellungen → Energie-Sensoren → „Dein Netzanschluss“**
**„Zwei getrennte Sensoren“** und ordne den **Netzbezug**- und den
**Einspeisung**-Sensor zu. PVM wertet beide getrennt aus: In der Übersicht
erscheinen dann eigene Kacheln und der Energiefluss zeigt Bezug und Einspeisung
unabhängig voneinander. Du kannst jederzeit zurück zu „Ein Sensor
(kombiniert)“ wechseln.

## 🤖 KI-Support

Du brauchst Hilfe? Kopiere den Prompt unten in deine KI – sie liest zuerst das
Projekt und stellt sich dann als PVM Assistant vor.

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
