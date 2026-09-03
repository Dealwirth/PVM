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

## Erste Schritte (kein Wizard)

1. Gehe zu **Einstellungen → Geräte & Dienste → Integration hinzufügen** und suche nach
   **„PV Manager“**. Es werden **keine Fragen gestellt** – die Installation ist sofort fertig.
2. PVM erstellt automatisch das **„PV Manager“-Dashboard** (mit Start-/Tutorial-Seite)
   und scannt beim Start einmal nach passenden Sensoren und Geräten.
3. Öffne das Dashboard: Die **Start-Seite** erklärt dir in drei kurzen Schritten,
   wie du Sensoren abliest, Geräte hinzufügst und Einstellungen anpasst.
4. **Gefundene Vorschläge** werden dir mit Live-Messwert zum Bestätigen angeboten;
   bei mehreren Treffern fragt PVM nach. Alles Weitere (Ziele, Prioritäten,
   Design) steuerst du direkt im Dashboard.

> Ein Setup-Wizard ist bewusst **kein** Teil von PVM mehr – alles läuft
> zentral im Dashboard, damit du nichts zweimal einrichten musst.

## Deinstallation

- **Einstellungen → Geräte & Dienste → PV Manager → Drei-Punkte-Menü → Löschen.**
- Dashboard ggf. unter **Einstellungen → Dashboards** entfernen.
- Optional: die HACS-Integration deinstallieren („Entfernen“ unter HACS → PV Manager).

## Updates

PVM wird über HACS aktualisiert („Update verfügbar“ → Update → Neustart).
Deine Konfiguration bleibt dabei vollständig erhalten.
