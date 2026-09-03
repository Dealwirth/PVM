# Installation

## Voraussetzungen
- Home Assistant 2025.2.0 oder neuer
- HACS (Home Assistant Community Store) installiert

## Schritt-für-Schritt

### 1. HACS öffnen
Klicke in der Seitenleiste auf HACS.

### 2. Custom Repository hinzufügen
Klicke auf die drei Punkte (⋮) in der oberen rechten Ecke und wähle **"Custom repositories"**.

### 3. URL eingeben
Gib die URL `https://github.com/Dealwirth/PVM` ein und wähle als Typ **"Integration"** aus.

### 4. Integration installieren
Suche in HACS nach **"PV Manager"** und klicke auf **"Herunterladen"**.

### 5. Neustart
Starte Home Assistant neu.

### 6. Einrichtung
Nach dem Neustart öffnet sich automatisch der **Setup-Wizard**. Folge den Anweisungen auf dem Bildschirm.

### 7. Dashboard
Nach der Einrichtung erscheint das **"PV Manager"**-Dashboard in deiner Seitenleiste.

## Fehlerbehebung

| Problem | Lösung |
| :--- | :--- |
| Integration wird nicht gefunden | Prüfe, ob HACS korrekt installiert ist |
| Setup-Wizard öffnet sich nicht | Gehe zu `Einstellungen` → `Geräte & Dienste` → `+ Integration hinzufügen` → Suche nach "PV Manager" |
| Dashboard wird nicht erstellt | Die Integration erstellt das Dashboard automatisch. Wenn nicht, kannst du es manuell in Lovelace erstellen. |