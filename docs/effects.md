# PVM: Was haben die Einstellungen für Auswirkungen?

Diese Seite erklärt für Einsteiger, was die wichtigsten Einstellungen in PVM
bewirken — und was passiert, wenn du sie ein- oder ausschaltest. Du brauchst
kein Vorwissen. Alle Angaben beziehen sich auf die Oberfläche unter
**Einstellungen** und den **Einrichtungsassistenten**.

> Kurz gesagt: Du kannst nichts „kaputt machen“. PVM prüft jede Änderung,
> speichert erst nach einem erfolgreichen Test und kann alle Daten per Backup
> sichern und wiederherstellen.

## 1. Verbindung zu Home Assistant

Im Einrichtungsassistenten wählst du, **wie** PVM dein Home Assistant erreicht.

| Verbindungsart   | Beispieladresse                  | Auswirkung                                                                                             |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Automatisch      | wird erkannt                     | PVM probiert die von HA gemeldete und bekannte lokale Adressen aus. Beste Wahl, wenn du unsicher bist. |
| Lokales Netzwerk | `homeassistant.local:8123`       | Läuft nur in deinem Heimnetz. Sicherste und schnellste Variante. Keine Freigabe nötig.                 |
| DuckDNS          | `meineinstanz.duckdns.org:8123`  | Läuft über das Internet. PVM erlaubt die öffentliche Adresse automatisch, wenn du diese Art wählst.    |
| Nabu Casa        | `meineinstanz.ui.nabu.casa`      | Home Assistant Cloud. Ebenfalls öffentlich — PVM erlaubt sie automatisch.                              |
| Docker           | `host.docker.internal:8123`      | Für PVM im Container, HA auf dem Host. Keine Freigabe nötig.                                           |
| Manuell          | z. B. `http://192.168.1.50:8123` | Für eigene Setups (Reverse-Proxy, anderer Port).                                                       |

**Lokale vs. öffentliche Adresse.** Eine lokale Adresse (z. B. `192.168.x.x`)
verlässt dein Heimnetz nicht. Eine öffentliche Adresse (DuckDNS/Nabu Casa) läuft
über das Internet. Deshalb ist **„Nur lokale HA-URL erlauben“** standardmäßig
aktiv und blockiert öffentliche Adressen. Wählst du DuckDNS oder Nabu Casa,
hebt PVM die Sperre für diese Adresse auf. Du kannst die Sperre auch manuell in
den Einstellungen unter **HA** umschalten.

**Der Token.** Der Long-Lived Access Token ist der Schlüssel zu Home Assistant.
PVM kann damit Geräte lesen und — nur wenn du die Steuerung aktivierst —
steuern. Er bleibt auf dem PVM-Server und wird nie im Browser angezeigt. Läuft
PVM nur lokal, ist das Risiko gering. Gib ihn nicht weiter.

**Der Verbindungstest.** Der Test ist unverbindlich: Es wird nichts gespeichert,
solange die Verbindung nicht klappt. Schlägt er fehl, bleiben deine bisherigen
Einstellungen unverändert. Typische Codes: `PVM-002` (HA nicht erreichbar),
`PVM-003` (Token abgelehnt), `PVM-016` (öffentliche Adresse blockiert).

## 2. Allgemeine Schalter

| Einstellung              | Standard | Was passiert, wenn sie AN ist                                                             | Wenn sie AUS ist                           |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| Auto-Start bei HA-Start  | an       | PVM startet automatisch, wenn Home Assistant startet.                                     | Du startest PVM selbst.                    |
| Abschaltung bei Fehler   | an       | Bei kritischen Fehlern werden Geräte sicher abgeschaltet.                                 | PVM meldet nur, schaltet aber nicht ab.    |
| Selbstheilung            | an       | PVM versucht, einen früheren Zustand automatisch wiederherzustellen.                      | Du behebst Fehler selbst.                  |
| Safety-Modus             | an       | Überwacht Grenzwerte (Leistung, Temperatur) und greift ein. Für Einsteiger empfohlen: an. | Keine automatischen Sicherheits-Eingriffe. |
| Backup/Export            | aus      | Schaltet die Backup-Karte frei (siehe unten).                                             | Keine Backups möglich.                     |
| Entwickler-Modus         | aus      | Zeigt zusätzliche technische Optionen und Details.                                        | Normale, aufgeräumte Ansicht.              |
| Auto-Cache / Auto-Update | an / aus | Auto-Cache beschleunigt die Anzeige; Auto-Update lädt neue Versionen.                     | Manuell aktualisieren.                     |

**Empfehlung für den Start:** Lass Abschaltung bei Fehler, Selbstheilung und
Safety-Modus **an**. Schalte **Backup/Export** ein, damit du sichern kannst.

## 3. Sicherheits-Grenzwerte

Unter **Einstellungen → Sicherheit** legst du Grenzwerte fest:

- **Max. Netzbezug (W):** Wird dieser Wert überschritten, reduziert PVM Lasten
  nach Priorität.
- **Max. Geräteleistung (W):** Ein einzelnes Gerät wird abgeschaltet, wenn es
  diese Grenze überschreitet.
- **Min. Batterie (%):** Fällt die Batterie darunter, passt PVM den Ladeplan an.
- **Sicherheits-Modus (Strict/Moderate/Lenient):** Wie streng Addons geprüft
  werden. Für Einsteiger: **Strict**.

Jedes automatische Eingreifen wird als Sicherheits-Ereignis protokolliert
(siehe Seite **Sicherheit**).

## 4. Backup & Wiederherstellung

Unter **Einstellungen → Backup & Wiederherstellung** kannst du alle PVM-Daten
in eine Datei sichern und später wieder einspielen.

**Enthalten:** Einstellungen, Geräte, Verlauf, Prognosen, Ladepläne, Kalender,
Addon-Konfigurationen und Sicherheits-Ereignisse.

**Nicht enthalten (aus Sicherheitsgründen):** dein HA-Token. Nach dem
Wiederherstellen musst du den Token einmal neu eintragen. Die Backup-Datei ist
unverschlüsselt — bewahre sie sicher auf.

**Wiederherstellen** ersetzt **alle** aktuellen PVM-Daten. Erstelle daher vorher
ein Backup. Schlägt die Datei-Prüfung fehl, wird nichts geändert (Fehlercode
`PVM-021`).

Wenn du das Backup lieber inklusive HA-Token möchtest (nicht empfohlen), kannst
du das beim Herunterladen auswählen — die Datei enthält den Token dann im
Klartext.

## 5. Fehlercodes (Auszug)

| Code    | Bedeutung                        | Was tun?                                                              |
| ------- | -------------------------------- | --------------------------------------------------------------------- |
| PVM-001 | Pflichteinstellung fehlt         | Einstellungen öffnen und markierte Felder ausfüllen.                  |
| PVM-002 | HA nicht erreichbar              | Adresse/Netzwerk prüfen; HA-Status prüfen.                            |
| PVM-003 | Token abgelehnt                  | Neuen Long-Lived Token in HA erstellen und eintragen.                 |
| PVM-016 | Öffentliche HA-Adresse blockiert | DuckDNS/Nabu Casa als Verbindungsart wählen oder Sperre deaktivieren. |
| PVM-021 | Backup ungültig                  | Eine mit dieser PVM-Version erstellte Backup-Datei verwenden.         |

Die vollständige Liste steht in [error-codes.md](error-codes.md).
