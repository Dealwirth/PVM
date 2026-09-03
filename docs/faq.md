# FAQ – Häufige Fragen

## Allgemein

### Was ist PVM?
PVM (PV Manager) ist eine Integration für Home Assistant, die deinen PV-Überschuss automatisch an Wallboxen, Wärmepumpen und andere Verbraucher verteilt.

### Wer hat PVM entwickelt?
PVM wurde von Dealwirth entwickelt und ist auf GitHub verfügbar.

## Installation

### Die Integration wird nicht in HACS angezeigt?
Stelle sicher, dass du das Custom Repository korrekt hinzugefügt hast: `https://github.com/Dealwirth/PVM`

### Der Setup-Wizard öffnet sich nicht?
Gehe zu `Einstellungen` → `Geräte & Dienste` → `+ Integration hinzufügen` → Suche nach "PV Manager".

## Konfiguration

### Meine Wallbox wird nicht erkannt?
Prüfe, ob die Wallbox bereits in Home Assistant integriert ist. PVM kann nur Geräte erkennen, die in Home Assistant vorhanden sind.

### Mein Auto wird nicht erkannt?
Stelle sicher, dass du einen SoC-Sensor für dein Auto hast (z.B. über die OBD2-Integration oder die Auto-Hersteller-Integration).

### Kann ich Prioritäten manuell festlegen?
Ja, im Dashboard unter **"Prioritäten"** kannst du die Geräte per Drag & Drop sortieren.

## Fehlerbehebung

### Die Integration stürzt ab?
Prüfe das Home Assistant-Log unter `Einstellungen` → `System` → `Logs`. Dort findest du Fehlermeldungen.

### Die Ladeleistung wird nicht richtig verteilt?
Prüfe, ob alle Sensoren korrekt konfiguriert sind. Die Leistungsverteilung basiert auf den Sensordaten.

## Erweiterung

### Kann ich weitere Gerätetypen hinzufügen?
Ja, die Integration ist modular aufgebaut. Neue Gerätetypen können einfach in `device_types/` hinzugefügt werden.

### Kann ich PVM mit anderen Integrationen kombinieren?
Ja, PVM bietet Services und Events, die von anderen Integrationen genutzt werden können.