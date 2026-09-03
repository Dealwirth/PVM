# Installation

> **Voraussetzungen:** Home Assistant ≥ 2025.2, [HACS](https://hacs.xyz) (empfohlen), Internetzugang auf GitHub.

## Variante 1: Per HACS-Button (empfohlen)

Öffne das [PVM-Repository](https://github.com/Dealwirth/PVM) im Browser und klicke
auf den großen **„Integration hinzufügen“**-Button im README. HACS öffnet sich
automatisch und zeigt dir das Repository zum Installieren an.

## Variante 2: Manuell in HACS

1. Öffne **HACS** → Drei-Punkte-Menü → **„Custom repositories“**.
2. Füge `https://github.com/Dealwirth/PVM` mit Typ **„Integration“** hinzu.
3. Suche in HACS nach **„PV Manager“** und installiere die Integration.
4. **Home Assistant neu starten.**

## Variante 3: Manuell (ohne HACS)

1. Lade das Repository als ZIP herunter (Releases → neueste Version).
2. Entpacke und kopiere den Ordner `custom_components/pvm` in dein
   `custom_components/`-Verzeichnis von Home Assistant.
3. **Home Assistant neu starten.**

## Erste Schritte (ein Klick, keine Fragen)

1. Gehe zu **Einstellungen → Geräte & Dienste → Integration hinzufügen** und suche nach
   **„PV Manager“**. Es werden **keine Fragen gestellt** – die Installation ist sofort fertig.
2. PVM erstellt automatisch die **„PV Manager“-Seite** in der Seitenleiste – eine
   **komplett eigene Oberfläche** (kein Lovelace, kein YAML) und scannt beim Start
   einmal nach passenden Sensoren und Geräten.
3. Öffne die Seite: Der Reiter **„Erste Schritte“** führt dich in wenigen Schritten
   durch Sensoren, Geräte, Reihenfolge und Design – alles direkt auf dieser Seite.
4. **Gefundene Vorschläge** (Reiter **„Gefunden“**) übernimmst du mit einem Klick;
   bei Geräten öffnet sich das vorausgefüllte Formular zum Bestätigen.

> Ein Setup-Wizard ist bewusst **kein** Teil von PVM mehr – alles läuft zentral
> auf der eigenen Seite, damit du nichts doppelt einrichten musst.

## Deinstallation

- **Einstellungen → Geräte & Dienste → PV Manager → Drei-Punkte-Menü → Löschen.**
- Optional: die HACS-Integration deinstallieren („Entfernen“ unter HACS → PV Manager).
- Ein früher erzeugtes Lovelace-Dashboard (`pvm-dashboard`) wird beim ersten
  Start automatisch entfernt; falls eines übrig bleibt, löschst du es unter
  **Einstellungen → Dashboards**.

## Updates

PVM wird über HACS aktualisiert („Update verfügbar“ → Update → Neustart).
Deine Konfiguration bleibt dabei vollständig erhalten.
