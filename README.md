☀️ PVM – PV Manager

""HACS" (https://img.shields.io/badge/HACS-Custom-orange.svg)" (https://hacs.xyz)
""Home Assistant" (https://img.shields.io/badge/Home%20Assistant-2025.2.0+-blue.svg)" (https://www.home-assistant.io)
""GitHub Release" (https://img.shields.io/badge/version-1.0.0-blue.svg)" (https://github.com/Dealwirth/PVM/releases)
""License" (https://img.shields.io/github/license/Dealwirth/PVM)" (LICENSE)

PVM ist ein intelligenter, modularer Energiemanager für "Home Assistant" (https://www.home-assistant.io/).

PVM verteilt deinen verfügbaren PV-Überschuss automatisch auf deine Verbraucher – zum Beispiel auf Wallboxen, Wärmepumpe, Waschmaschine, Lüftung oder Poolpumpe.

Die Reihenfolge bestimmst du selbst über eine Prioritätenliste.

«☀️ PV-Überschuss → Prioritäten → Verbraucher»

<p align="center">
  <a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=Dealwirth&repository=PVM&category=integration">
    <img src="https://img.shields.io/badge/Integration_hinzufügen-41BDF5?style=for-the-badge&logo=homeassistant&logoColor=white" alt="Integration hinzufügen" width="100%">
  </a>
  <br>
  <em>Klicke auf den Button, um PVM direkt über HACS zu öffnen.</em>
</p>---

📌 Inhaltsverzeichnis

- "🚀 Schnellstart" (#-schnellstart)
  - "Was kann PVM?" (#was-kann-pvm)
  - "Installation" (#installation)
  - "Bedienung" (#bedienung)
- "🤖 KI-Support" (#-ki-support)
- "🔧 Für Entwickler" (#-für-entwickler)
  - "Neues Gerät hinzufügen" (#neues-gerät-hinzufügen)
  - "Wichtige Dateien" (#wichtige-dateien)
  - "Code-Stil" (#code-stil)
  - "Testen" (#testen)
  - "Pull Requests" (#pull-requests)
- "📜 Lizenz" (#-lizenz)

---

🚀 Schnellstart

Was kann PVM?

PVM ist modular aufgebaut.

Du musst nicht alle unterstützten Geräte besitzen. Wenn du beispielsweise nur eine Wallbox hast, kannst du PVM auch nur dafür verwenden. Hast du zusätzlich eine Wärmepumpe oder weitere Verbraucher, können diese ebenfalls eingebunden werden.

☀️ Funktionen

- ⚡ Automatische PV-Überschussverteilung
- 🚗 E-Auto-Laden
- 🔋 Ladeziele und Ladegrenzen
- ⏰ Zeitbasierte Ladeziele
- ♨️ Wärmepumpen-Steuerung
- 🧺 Waschmaschine und weitere Verbraucher
- 🌬️ Lüftung
- 🏊 Poolpumpe
- 🎯 Frei definierbare Prioritäten
- 🖱️ Prioritäten per Drag & Drop
- 📊 Übersichtliches PVM-Dashboard
- 🧩 Modular erweiterbar

---

Installation

Variante 1 – HACS Button ⭐ Empfohlen

Klicke oben auf den Button „Integration hinzufügen“.

HACS öffnet anschließend direkt die PVM-Integration.

1. PVM über HACS installieren.
2. Home Assistant neu starten.
3. Zu Einstellungen → Geräte & Dienste wechseln.
4. Integration hinzufügen auswählen.
5. Nach PV Manager suchen.
6. Den Setup-Assistenten durchlaufen.
7. Fertig.

---

Variante 2 – Manuell über HACS

Falls der Button nicht funktioniert:

1. HACS öffnen.

2. Das Menü ⋮ öffnen.

3. Benutzerdefinierte Repositories auswählen.

4. Folgende Repository-URL eintragen:
   
   "https://github.com/Dealwirth/PVM"

5. Als Typ Integration auswählen.

6. Nach PV Manager suchen.

7. PVM installieren.

8. Home Assistant neu starten.

9. Zu Einstellungen → Geräte & Dienste gehen.

10. Integration hinzufügen → PV Manager auswählen.

---

Bedienung

Nach der Installation führt dich der Setup-Assistent durch die wichtigsten Einstellungen.

🎯 Prioritäten

Die Verbraucher werden entsprechend deiner Prioritäten mit verfügbarem PV-Überschuss versorgt.

Beispiel:

1. 🚗 Wallbox
2. ♨️ Wärmepumpe
3. 🧺 Waschmaschine
4. 🏊 Poolpumpe

Die Reihenfolge kann über die Benutzeroberfläche verändert werden.

---

🚗 E-Auto

Je nach Konfiguration können Ladeziele und Ladegrenzen berücksichtigt werden.

Beispiele:

- Mindest-Ladeziel
- Maximale Ladung
- gewünschter Ladezustand
- gewünschte Ladezeit
- Laden mit verfügbarem PV-Überschuss

---

⚡ Power Charge

Mit Power Charge kann ein Fahrzeug unabhängig von der normalen PV-Priorisierung mit maximal verfügbarer Leistung geladen werden.

---

♨️ Wärmepumpe

PVM kann die Wärmepumpe in die Energieverteilung einbeziehen.

Der optionale WP-Test kann verwendet werden, um den Verbrauch während eines definierten Heizvorgangs zu ermitteln.

---

«💡 Du musst kein YAML schreiben.

Die Einrichtung und Bedienung erfolgt über die Home-Assistant-Oberfläche.»

---

🤖 KI-Support

Du brauchst Hilfe bei PVM?

Dann kannst du den folgenden Prompt einfach kopieren und beispielsweise in ChatGPT einfügen.

📋 PVM Assistant Prompt

Ich brauche Hilfe bei der Home Assistant-Integration „PVM – PV Manager“ von GitHub:

https://github.com/Dealwirth/PVM

Bitte lies dir zuerst das README und das gesamte Projekt durch, um PVM vollständig zu verstehen.

PVM ist ein modularer Energiemanager für PV-Überschuss. Die Integration kann unter anderem Wallboxen, Wärmepumpen und weitere Verbraucher steuern.

Stell dich als „PVM Assistant“ vor.

Beginne mit:

„Ich bin dein PVM Assistant. Wie kann ich dir helfen?“

Antworte danach immer kurz, klar und verständlich.

Keine unnötig langen Erklärungen.

Wenn du etwas nicht sicher weißt, frage kurz nach, statt etwas zu erfinden.

Wenn es um einen Fehler geht, frage zuerst nach den Informationen, die du zur Diagnose wirklich benötigst.

Wenn möglich, gib konkrete Schritt-für-Schritt-Anweisungen für Home Assistant.

💡 Warum gibt es keinen „Kopieren“-Button?

GitHub-READMEs erlauben kein beliebiges JavaScript, das beim Anklicken eines HTML-Buttons ausgeführt wird.

Ein Codeblock wie oben funktioniert dagegen zuverlässig:

1. Auf das Kopieren-Symbol des Codeblocks klicken.
2. Der komplette Prompt wird kopiert.
3. In ChatGPT oder eine andere KI einfügen.

Damit ist kein eigenes JavaScript im README erforderlich.

---

🔧 Für Entwickler

PVM ist modular aufgebaut und kann um weitere Gerätetypen erweitert werden.

Technische Grundlagen

Thema| Details
Sprache| Python 3.11+
Framework| Home Assistant
Architektur| Async/Await
Installation| HACS
Externe Abhängigkeiten| Keine zusätzlichen externen Bibliotheken erforderlich
Erweiterung| Über die Device-Type-Registry

---

Neues Gerät hinzufügen

Um einen neuen Gerätetyp zu integrieren:

1. Eine neue Datei im Ordner "custom_components/pvm/device_types/" erstellen.
2. Von "BaseDevice" erben.
3. Die benötigten Methoden implementieren.
4. Den neuen Gerätetyp in der entsprechenden Registry registrieren.

Typische Methoden sind:

async_get_power()
async_set_power(value)
async_turn_on()
async_turn_off()

Welche Methoden tatsächlich erforderlich sind, hängt vom jeweiligen Gerätetyp ab.

---

Wichtige Dateien

Datei| Zweck
"config_flow.py"| Setup und Konfiguration
"const.py"| Konstanten und zentrale Definitionen
"sensor.py"| Sensor-Entitäten
"switch.py"| Schalter und Steuerfunktionen
"device_types/base.py"| Basisklasse für Geräte
"device_types/wallbox.py"| Wallbox-Funktionen
"device_types/wärmepumpe.py"| Wärmepumpen-Funktionen

---

Code-Stil

Bei Änderungen am Projekt:

- Async/Await für I/O-Operationen verwenden.
- Type Hints verwenden.
- Funktionen und Klassen sinnvoll dokumentieren.
- Home-Assistant-Konventionen einhalten.
- Keine unnötigen externen Abhängigkeiten hinzufügen.
- Bestehende Architektur und Registry-Strukturen berücksichtigen.

---

Testen

Tests befinden sich im entsprechenden "tests/"-Verzeichnis.

Lokale Tests können beispielsweise mit "pytest" ausgeführt werden:

pytest

Zusätzlich werden Änderungen über die vorhandenen GitHub-Actions geprüft.

---

Pull Requests

Für Beiträge zum Projekt:

1. Einen eigenen Branch erstellen.
2. Änderungen durchführen.
3. Tests ausführen.
4. Änderungen dokumentieren, falls erforderlich.
5. Pull Request erstellen.

Bitte bestehende Projektstrukturen und Coding-Konventionen beibehalten.

---

📜 Lizenz

PVM steht unter der MIT License.

Siehe ""LICENSE"" (LICENSE).

---

<p align="center">
  Made with ❤️ by <strong>Dealwirth</strong>
</p>