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

## Einrichtung (Wizard)

1. Gehe zu **Einstellungen → Geräte & Dienste → Integration hinzufügen** und suche nach **„PV Manager“**.
2. Wähle **„Automatische Einrichtung“**, damit PVM passende Sensoren vorschlägt
   (oder „Manuelle Einrichtung“).
3. Wähle deine **Energie-Sensoren** (PV und/oder Netz – mindestens einen).
4. Füge deine **Geräte** hinzu: Wallboxen/E-Autos, Wärmepumpe, Verbraucher.
   Jedes Formular ist mit der Auto-Erkennung vorbefüllt – einfach bestätigen oder anpassen.
5. Fertig. Das **„PV Manager“-Dashboard** erscheint automatisch in der Seitenleiste.

## Deinstallation

- **Einstellungen → Geräte & Dienste → PV Manager → Drei-Punkte-Menü → Löschen.**
- Dashboard ggf. unter **Einstellungen → Dashboards** entfernen.
- Optional: die HACS-Integration deinstallieren („Entfernen“ unter HACS → PV Manager).

## Updates

PVM wird über HACS aktualisiert („Update verfügbar“ → Update → Neustart).
Deine Konfiguration bleibt dabei vollständig erhalten.
