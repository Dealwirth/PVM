# Konfiguration

> 📖 **PV Manager – Dokumentation** · [⬅️ Zurück zum README](../README.md) · [Häufige Fragen](faq.md)

Alles wird **ohne YAML** auf der eigenen **PV-Manager-Seite** konfiguriert
(Seitenleiste). Die Installation selbst ist ein Klick ohne Fragen; Messungen,
Geräte, Reihenfolge und Einstellungen verwaltest du ausschließlich dort –
auf einer **eigenständigen Seite**, die PVM selbst mitbringt (kein Lovelace,
keine HA-Dialoge, kein Options-Flow).

Die Seite hat sechs Reiter:

| Reiter | Zweck |
| --- | --- |
| **Erste Schritte** | Mini-Tutorial: Sensoren ablesen → Geräte hinzufügen → einstellen. Zeigt den aktuellen Stand und leitet dich zum nächsten Schritt. |
| **☀️ Übersicht** | Live-Energiefluss: PV, Haus, Netz, Überschuss und jedes Gerät mit aktuellem Wert – animiert und farbcodiert. |
| **🔌 Geräte** | Alle Geräte ansehen, hinzufügen, bearbeiten, entfernen und einzeln steuern. |
| **⬆️ Reihenfolge** | Prioritätenliste per ▲/▼-Buttons (oben = bekommt zuerst Strom). |
| **🔍 Gefunden** | Vorschläge der Auto-Erkennung mit Begründung und Live-Messwert – per Klick übernehmen. |
| **🎨 Einstellungen** | Globale Regeln und Design – aufklappbare Gruppen, Schieberegler für Laien. |

Jede Änderung wird sofort über die PVM-WebSocket-Kommandos gespeichert und
wirkt ab dem nächsten Steuerzyklus (30 s).

## Energie-Messung

PVM braucht mindestens **einen** Weg, um den Überschuss zu kennen. Alles wird
unter **🎨 Einstellungen → Energie-Sensoren** verbunden – jede Zeile hat einen
„Wählen“-Button mit Suchfeld, und du kannst Sensoren **jederzeit ändern oder
entfernen**:

| Sensor | Wofür? | Empfohlen |
| --- | --- | --- |
| **PV-Leistung** | Erzeugung des Wechselrichters. | Immer sinnvoll |
| **Netz (kombiniert)** | Ein Zähler liefert beides: Bezug positiv, Einspeisung negativ (z. B. Shelly EM, viele Zähler). | ⭐ Am genauesten |
| **Netzbezug + Einspeisung (getrennt)** | Zwei eigene Zähler – z. B. SolarNet mit getrennten Sensoren für Bezug und Einspeisung. Wählbar über „Dein Netzanschluss → Zwei getrennte Sensoren“. | ⭐ SolarNet & Co. |
| **Hausverbrauch** (optional) | Nur nötig, wenn weder Netz-Sensor noch getrennte Zähler vorhanden sind (Überschuss = PV − Haus). | – |
| **Speicher-Leistung / -SoC** (optional) | Anzeige im Energiefluss und für Diagnosen. | – |

**Dein Netzanschluss:** Oben in der Energie-Gruppe entscheidest du zwischen
„Ein Sensor (Bezug + / Einspeisung −)“ und „Zwei getrennte Sensoren“ – PVM
zeigt nur die passenden Felder und wertet beide Varianten korrekt aus
(bei getrennten Zählern werden Bezug und Einspeisung unabhängig angezeigt).
Die Wahl wird gespeichert und bleibt auch nach Reloads/Neustarts erhalten.
Für den kombinierten Sensor gibt es zusätzlich die Vorzeichen-Auswahl
(„Bezug positiv (+), Einspeisung negativ (−)“, „Invertiert: Einspeisung
positiv (+), Bezug negativ (−)“ oder „Nur Einspeisung“) – für Zähler, die
Werte umgekehrt oder nur die Einspeisung liefern.

Die Auswahlfelder akzeptieren **alle passenden Entitätenarten** (Sensor-,
Zähler- und Zahlen-Entitäten) und zeigen verständliche Namen – der alte
kryptische Fehler „expected (sensor)“ ist damit behoben. Findet PVM deine
Sensoren selbst, erscheinen sie unter **🔍 Gefunden** und du übernimmst sie
mit einem Klick.

**Einspeise-Reserve:** Leistung in Watt, die PVM als Puffer zurückhält
(Standard 100 W). So werden kurzzeitige Wolken oder Messschwankungen nicht
sofort an die Verbraucher weitergereicht – einstellbar unter
**🎨 Einstellungen → Steuerung** (Schieberegler).

> **Hinweis:** Ohne Haus-Sensor und ohne Netz-Sensor wird die komplette
> PV-Leistung als Überschuss behandelt – dann sollte der Hausverbrauch klein
> sein oder ein Netz-Sensor nachgerüstet werden.

## Geräte

Unter **🔌 Geräte → „Gerät hinzufügen“** öffnet sich ein eigenes, übersichtliches
Formular. Es kennt alle gängigen Geräte und zeigt **nur die Felder, die zu
deiner Auswahl passen** – nichts Kompliziertes nebenher.

| Rolle | Steuerung | Optionale Sensoren | Besonderheiten |
| --- | --- | --- | --- |
| **Wallbox** | Ein Schalter oder zwei Taster, plus „Leistungs-Begrenzer vorhanden“ | Ladeleistung | Zwei Schieberegler: maximale Ladeleistung & Mindest-Überschuss |
| **Auto (E-Auto)** | keine (reine Überwachung) | SoC, Ladeleistung | Mindest-/Max-SOC, Frist-Ziele, Power Charge, Netz-Freigaben – alles **am Auto**, nicht an der Wallbox |
| **Wärmepumpe** | Schalter/Zwei Taster oder **Nur Ziel-Temperatur** (kein Ein/Aus) | Temperatur (Pflicht), Leistung | Soll-/Boost-Temperatur, Notfall-Minimum |
| **Verbraucher** | Ein Schalter oder zwei Taster, plus „Leistungs-Begrenzer vorhanden“ | Leistung | Nennleistung & Mindest-Überschuss als Schieberegler |

**Karte antippen = alles einstellen:** Ein Klick auf eine Geräte-Karte öffnet
das komplette Formular (Typ, Steuerung, Sensoren, Ziele). Entitäts-Felder
sind dabei **frei tippbar** („Entitäts-ID tippen oder wählen“) – wer die ID
kennt, muss nicht suchen; getippte Werte bleiben auch beim Blättern erhalten.

**Ganz einfach gehalten:** Der Dialog zeigt immer nur die wichtigen Felder.
Seltenere Optionen stecken bewusst unter **„Erweiterte Einstellungen“**
(klickbar aufklappbar), lange Beschreibungen hinter einem **ⓘ**-Symbol –
nichts wirkt nach dem Öffnen überladen, alles bleibt erreichbar und wird
gespeichert.

**Steuerungsarten – du wählst eine, die Felder erscheinen automatisch:**

- **Ein Schalter (An/Aus):** PVM schaltet die Entität. Das Gerät läuft mit
  seiner normalen Leistung oder gar nicht.
- **Zwei Taster (Start/Stopp):** Für Geräte mit getrennten Tastern (z. B.
  manche Wallboxen: ein Taster für Start, einer für Stopp). Dazu wird der
  **Ladeleistungs-Sensor** als Pflichtfeld abgefragt – an ihm erkennt PVM,
  ob das Gerät wirklich läuft, und drückt die Taster nur bei echten
  Zustandswechseln (kein Doppel-Start/-Stopp).
- **Leistungs-Begrenzer vorhanden?** Ein eigenes Feld pro Gerät: „Hat mein
  Gerät eine Leistungs-Begrenzung?“ (z. B. Max-Strom einer Wallbox). Ist es
  an, setzt PVM zusätzlich einen Sollwert an eine Nummern-Entität und kann
  den Überschuss fein verteilen. Einheit (`W`, `kW`, `A`, `mA`) und
  Phasenzahl fragt das Formular ab und rechnet Watt ↔ Ampere selbst um.
- **Nur Ziel-Temperatur (Wärmepumpe):** Für Wärmepumpen, die sich **nicht**
  an-/ausschalten lassen – nur die gewünschte Speichertemperatur einstellbar
  ist. PVM hebt die Ziel-Temperatur bei Überschuss an und stellt sie bei zu
  wenig Überschuss wieder auf die normale Soll-Temperatur zurück.

Alle Schieberegler zeigen **live ihren aktuellen Wert** an – du musst nie
raten, auf welcher Zahl du gerade stehst.

**Automatik-Schalter:** Jedes Gerät hat einen Schalter
„**Automatik (Überschuss)**“. Nur wenn er an ist, steuert PVM das Gerät.
Ausgeschaltete, noch laufende Geräte werden sanft gestoppt. Du kannst den
Schalter auch in Home Assistant direkt nutzen – er ist eine normale Entität.

## Prioritäten

Die Reihenfolge der Geräte bestimmt, **wer zuerst Überschuss bekommt**
(1 = höchste Priorität). Im Reiter **⬆️ Reihenfolge** verschiebst du Geräte
mit **▲/▼-Buttons** – das Ergebnis wird sofort gespeichert und animiert
angezeigt. **Autos stehen dort bewusst nicht** (reine Überwachung – sie
belegen keinen Rang); die Pfeile springen über sie hinweg. Alternativ geht es
über den Service `pvm.set_priority`.

## E-Autos

| Wert | Bedeutung |
| --- | --- |
| **Mindest-SOC** | Garantierter Ladezustand. Ist er unterschritten, lädt PVM (Netzstrom erlaubt) mit begrenzter Leistung, bis der Mindestwert erreicht ist. |
| **Max-SOC** | Ladestopp (Überschuss- und Power-Charge-Laden). |
| **Frist-Ziel-SOC + Frist-Zeit** | „Bis 18:00 sollen 80 % erreicht sein.“ PVM berechnet, wann der Garantie-Ladevorgang spätestens starten muss, und lädt dann nötigenfalls mit Netzstrom. |
| **Power Charge** | Manueller Schalter: lädt mit voller Leistung (Netzstrom erlaubt) bis zum Max-SOC und schaltet danach automatisch ab. |
| **Netz für Mindest-SOC / Frist** | Schalter, ob für diese Garantien Netzstrom genutzt werden darf. |

Die Batteriekapazität (kWh) wird benötigt, um aus dem SoC (Prozent) den
Energiebedarf zu berechnen. Der SoC-Sensor aktualisiert oft nur langsam –
PVM berücksichtigt das automatisch und lädt nicht blind weiter.

**Wo ist welches Auto?** Standardmäßig ist die **automatische Auto-
Erkennung aus** (Einstellungen → Steuerung): PVM nutzt dann nur die
**Heimat-Wallbox**, die du im Auto-Dialog wählst („Wo ist dieses Auto zu
Hause?“). Schaltest du die Auto-Erkennung ein, erkennt PVM die Zuordnung
automatisch über den **Einsteck-Zeitpunkt**: Steigt die Ladeleistung einer
Wallbox und eines Autos im selben Moment an (z. B. beide um 12:33),
kombiniert PVM beides und **speichert** die Zuordnung dauerhaft. Lädt nur
ein Auto, ist die Zuordnung trivial; bei mehreren zählen zusätzlich die
(unterschiedlichen) Ladeleistungen. Auf der Wallbox-Karte steht dann
🚗 *Auto* (lädt gerade) bzw. 🏠 *Auto (zu Hause)* (gelernt); der
Auto-Status-Sensor `sensor.pvm_car_status_*` liefert zusätzlich die
Attribute `home_wallbox_id`/`home_wallbox_name`.

**Auto und Wallbox sind getrennt, koppeln sich aber automatisch:** Alle
Lade-Wünsche (Mindest-/Max-SOC, Frist-Ziele, Power Charge, Netz-Freigaben)
stellst du **am Auto** ein – nicht an der Wallbox. Die Wallbox-Konfiguration
bleibt auf die Hardware beschränkt (Leistungs-Sensor, Steuerung, Limits).
Beim Laden übernimmt PVM automatisch die Ziele des Autos, das an der
Wallbox hängt – die Kachel der Wallbox zeigt dann „Ziel …“ des zugeordneten
Autos. So kannst du jedes Auto individuell einstellen, egal an welcher
Wallbox es hängt.

## Wärmepumpe

- **Soll-Temperatur:** Bei Unterschreitung + Überschuss heizt die WP.
- **Nur Ziel-Temperatur (ohne Ein/Aus):** Kann deine Wärmepumpe nicht
  geschaltet werden, wähle diese Steuerungsart und weise die
  Ziel-Temperatur-Entität zu. PVM stellt dann bei genügend Überschuss die
  **Ziel bei Überschuss**-Temperatur ein und bei zu wenig Überschuss wieder
  die **normale Soll-Temperatur** – mit Hysterese, damit es nicht
  hin- und herspringt. Die Auto-Erkennung schlägt diese Art selbst vor,
  wenn sie eine einstellbare Temperatur findet.
- **Netz im Notfall:** Fällt die Speichertemperatur unter das
  **Notfall-Minimum** (Standard **60 °C** – Legionellen-/Bakterienschutz),
  heizt die WP zur Not auch mit Netzstrom, damit das Wasser nie zu kalt
  wird. Der Wert ist einstellbar, aber erst ab 60 °C möglich.
- **Temperatur-Regler mit Zonen:** Alle Temperatur-Schieberegler (Soll-,
  Boost- und Notfall-Minimum) zeigen farbig die Bereiche: **rot = zu kalt**
  (unter 55 °C – Bakterien-/Legionellen-Gefahr), **grün = gesund**
  (55–70 °C) und **rot = unnötig heiß** für die Heizung (über 70 °C).
  Striche markieren die Grenzen – so siehst du beim Einstellen sofort, ob
  dein Wert sicher ist.

## Modus (global)

**Automatik / Manuell:** Der große Umschalter in **Einstellungen → Steuerung**
bestimmt, ob PVM überhaupt steuert. **Automatik** (Standard): PVM verteilt
den Überschuss. **Manuell:** PVM misst nur noch mit (Überschuss bleibt
aktuell) und lässt alle Geräte in Ruhe – du steuerst selbst.

Der Betriebsmodus sitzt oben auf der Seite (und existiert zusätzlich als
Entität `select.pvm_mode`):

| Modus | Verhalten |
| --- | --- |
| **Auto (Überschuss + Ziele)** | Alles aktiv. |
| **Nur Überschuss** | Kein Netzstrom – auch nicht für Fristen (Fristen dann „best effort“). |
| **Nur Ziele** | Nur Frist-/Mindest-Ziele und Power Charge; kein Überschuss-Laden. |
| **Aus** | Keine automatische Steuerung (laufende Geräte bleiben wie sie sind). |

## Pro Gerät: Automatik / Manuell (direkt auf der Karte)

Jede Gerätekarte hat einen **Auto | Manuell**-Umschalter: In **Auto**
entscheidet PVM selbst (Prioritätsliste, Ziele, Prognose). In **Manuell**
lässt PVM das Gerät in Ruhe – du steuerst direkt. Über das ⚙-Symbol klappt
sich ein **kleines Bedien-Menü** auf (nicht größer als nötig): Ein/Aus-
Knöpfe bei Schaltern, Start/Stopp bei zwei Tastern, den **Leistungs-
Begrenzer**-Regler (falls vorhanden) und bei „Nur Ziel-Temperatur“-Wärme-
pumpen die Ziel-Temperatur. Jeder Regler zeigt seinen Wert live und
speichert sofort.

Alle Steuerbefehle laufen über den PVM-Manager (`pvm/control`) – die
Reaktion kommt immer mit einer verständlichen Meldung zurück, die
Reglerwerte werden vor dem Senden an die echten Entitäts-Grenzen
angepasst (kein „out_of_range“), und die Karte zeigt den neuen Zustand
sofort (Auto/Manuell und Ausklappmenü aktualisieren sich direkt).

## Statistik & Prognose

Der Reiter **📊 Statistik** zeigt deine Leistungen als farbige Charts
(Fläche oder Linie) – einstellbar über **Modi** (Alles, Nur PV, Verbraucher,
Wallboxen, Netz) und Zeiträume (24 h / 7 Tage). **Jede Reihe lässt sich
einzeln an- und abwählen** über die Punkte unter dem Diagramm; die Farben
folgen deinem Design und deiner Wunschfarbe.

Die Kurven kommen **direkt aus der Home-Assistant-Historie (Recorder)** –
genau wie das HA-eigene Verlaufs-Diagramm. PVM fragt den Verlauf über das
moderne `history/history_during_period`-Kommando ab und fällt bei älteren
HA-Versionen automatisch auf das klassische `recorder/…`-Kommando zurück.
Ist die Aufzeichnung aus, erscheint eine verständliche Hinweismeldung
statt eines leeren Bildes.

**Schnell & flüssig:** Das Diagramm skaliert mit deiner Fensterbreite (auch
Uhrzeit-Beschriftungen passen sich automatisch an), Reihen lassen sich per
Klick **sofort** an-/abwählen, und Modi bzw. Fläche/Linie werden direkt im
Diagramm umgesetzt – ohne langes Neu-Laden. Während des Ladens läuft oben
auf der Seite ein Ladebalken.

Darunter steht die **PV-Prognose**: erwartete Leistung **jetzt, in 15
Minuten, nächste 3 Stunden und für den Rest des Tages** – sie ist
**standardmäßig ausgeschaltet** und erscheint erst, wenn du sie unter
*Einstellungen* aktivierst. Seit **1.9.9 funktioniert sie ganz ohne
API-Schlüssel**: PVM kombiniert die kostenlose Open-Meteo-Strahlung mit
einer **Lernkurve aus deinen letzten Tagen** (Sonnenstand → PV-Leistung).
PVM nutzt diese Vorhersage, um kurze Wolkenphasen nicht zum Abschalten zu
nutzen („erst abwarten, die Sonne kommt gleich wieder“). Bevorsteht in den
nächsten 15 Minuten ein Einbruch, zeigt der Statistik-Reiter einen
**orangefarbenen Benachrichtigungspunkt**.

Unter **Einstellungen → PV-Prognose & smartes Laden** findest du die
Schalter **PV-Prognose** (Standard aus) und **Vorausschauendes Laden**
(Standard an). Beim **Aktivieren wird die Prognose sofort berechnet**
(auch per Button „Prognose jetzt aktualisieren“) – nicht erst im
15-Minuten-Takt.

### Standort & API-Schlüssel (Schlüssel seit 1.9.9 optional)

- **Standard:** PVM nutzt die **Koordinaten deiner Home-Assistant-
  Installation** (unter *Einstellungen → System → Allgemein* einstellbar).
  Bei der Einrichtung fragt PVM deshalb: „Steht deine PV-Anlage hier?“
- **PV woanders?** Im Abschnitt *Standort, Koordinaten & optionaler
  API-Schlüssel* kannst du Breiten- und Längengrad deiner Anlage
  hinterlegen.
- **Kein Schlüssel nötig (Standard):** PVM fragt die **kostenlose
  Open-Meteo-Strahlung** (`api.open-meteo.com`) ab und kombiniert sie mit
  einer gelernten Lernkurve aus deinen letzten Tagen (Sonnenstand →
  PV-Leistung).
- **API-Schlüssel (optional):** Wer mag, hinterlegt zusätzlich einen
  eigenen Schlüssel für den stabileren Kunden-Endpunkt
  (`customer-api.open-meteo.com`): ①
  [open-meteo.com/en/pricing](https://open-meteo.com/en/pricing) öffnen
  und einen Tarif wählen, ② direkt nach dem Checkout erhältst du **sofort
  deinen API-Schlüssel**, ③ Schlüssel im Feld „API-Schlüssel“ einfügen und
  „Prognose jetzt aktualisieren“ drücken.

> **Wichtig:** In das Feld „API-Schlüssel“ gehört **nur der kurze Code**
> aus deinem Tarif (z. B. `aB3xK9…`) – **keine URL**. Die Adresse
> `api.open-meteo.com/…` ist kein Schlüssel. PVM warnt und bricht ab, falls
> du versehentlich eine URL einfügst.

**Feedback während der Berechnung:** Solange die Prognose rechnet, zeigt
PVM einen Spinner mit „PV-Prognose wird berechnet …“ (erste Abfrage kann
10–30 s dauern – danach wird gecacht). Antwortet Open-Meteo mit 401/403/429
(Schlüssel ungültig, Limit erreicht), erscheint eine verständliche Meldung
statt still leerer Kurven.

### 📈 PV-Analyse – die Lernkurve

Im Reiter **Statistik** findest du darunter die **PV-Analyse**: PVM zeigt
aus den letzten ~14 Tagen, wie viel Leistung deine Anlage **bei welchem
Sonnenstand** erzeugt hat (normiert auf wolkenlose Einstrahlung) und eine
**Tagesbilanz** (Erzeugung, Spitze, Sonnenschein). Genau diese Kurve treibt
die Prognose – je mehr sonnige Tage gesammelt sind, desto genauer wird die
Vorhersage. Die Analyse lässt sich per Knopf aktualisieren.

Letzteres (Vorausschauendes Laden) bedeutet: Hat ein Auto eine **aktive
Frist** (Ziel bis Uhrzeit), bleibt die Wallbox auch über eine kurze
Wolkenphase an, statt abzuschalten – so geht untertags keine Ladezeit
verloren und es wird seltener geschaltet. Ohne Frist fahren Wallboxen
weiterhin live herunter, damit keine Energie aus dem Netz geholt wird.

## Gerätesuche (Auto-Erkennung)

Beim Start sucht PVM automatisch einmal nach passenden Sensoren und Geräten;
jederzeit wiederholbar über den Button **„Jetzt suchen“** (Reiter **🔍 Gefunden**)
oder den Service `pvm.scan_devices`. Die Suche durchsucht die **Entity- UND
Device-Registry** aller Integrationen – inklusive Hersteller-/Modell-
Informationen (z. B. SMA, go-e, openWB, Vaillant). Gefundene Messungen und
Geräte werden **mit Begründung und aktuellem Messwert** vorgeschlagen; bei
mehreren Treffern fragt PVM nach. Übernehmen heißt: Klick auf „Übernehmen“ –
der Vorschlag verschwindet sofort aus der Liste (und wird bestätigt), bei
Geräten öffnet sich das **vorausgefüllte Formular** zum Bestätigen.
Nichts wird ohne deine Bestätigung konfiguriert.

### Energie-Sensoren automatisch vorschlagen

Unter **Einstellungen → Energie-Sensoren** findest du den Button
**„Automatisch finden“**: PVM schlägt für freie Plätze (PV, Netz, Haus)
passende Sensoren vor und zeigt sie in einem Dialog zur Bestätigung – mit
einem klaren Hinweis, **selbst kurz zu prüfen**, ob es die richtigen sind.
Dabei prüft PVM die **Plausibilität**: Zählerstände (kWh) werden z. B. als
unpassend markiert, bevor sie die Anzeige verfälschen. Schon belegte
Messungen werden nie überschrieben; nicht benötigte Sensoren (z. B. kein
Speicher vorhanden) bleiben frei und können jederzeit entfernt werden
(Sensor-Karte → Sensor entfernen).

## Design & Darstellung

- Unter **🎨 Einstellungen → Design** wechselst du zwischen vier Looks:
  🏠 **Home Assistant** (Standard – übernimmt automatisch die Farben und das
  helle/dunkle Erscheinungsbild deines HA-Themes), ☀️ **Sonnenaufgang**
  (warme Gelb-/Orange-Töne), 🌿 **Natur-frisch** (Grün) und 🌊 **Kühl & klar**
  (Blau). Der Wechsel gilt sofort.
- **Deine Farbe (ersetzt das HA-Blau):** Unter **Einstellungen → Design →
  Deine Farbe** bestimmst du die Hauptfarbe für Knöpfe, Verläufe, Fortschritt
  und kleine Details – also genau die Farbe, die bei „Home Assistant“ blau
  ist. Wählbar: Automatisch (Farbe deines HA-Designs), Grün, Orange, Lila,
  Rot, Türkis, Blau – oder **Eigene Farbe …** mit einem freien Farbfeld
  (beliebiger Hex-Wert, wird gespeichert und überlebt Neustarts). Die Wahl
  wirkt in allen vier Designs und ersetzt dort die jeweilige Standardfarbe.
- **Energie-Sensoren mit Haken & Details:** In **Einstellungen → Energie-
  Sensoren** trägt jede verbundene Messung einen grünen **✓ Verbunden**-
  Haken. Ein **Klick auf die Karte** klappt die Details auf: welche Entität
  verbunden ist, mit welchem Wert und dem aktuellen Messwert – plus
  „Sensor wählen“ / „Entfernen“.
- **Seitenleiste & Logo:** Die Seite heißt in der Seitenleiste schlicht
  **PVM** und zeigt das eigene PVM-Logo (auch im Kopf der Seite und als
  HACS-/Projekt-Logo verwendet).
- **Einführung ausblenden:** Auf „Erste Schritte“ steht „🎉 Einführung
  beenden“, sobald alles eingerichtet ist – danach ist die Seite aufgeräumt.
  Noch nicht fertig? Der kleine Link „Einführung überspringen“ erledigt das
  ebenfalls; „Einführung erneut ansehen“ holt sie zurück.
- Auch als Entität vorhanden: `select.pvm_theme` – nützlich für Automatisierungen
  (z. B. abends automatisch das Abend-Design).
- **Auto-Ziele als Entitäten:** Seit der Trennung von Auto & Wallbox haben
  auch Autos eigene Entitäten für Automationen – `number.pvm_min_soc_<id>` /
  `max_soc` / `deadline_soc`, `time.pvm_deadline_time_<id>` sowie die Schalter
  `switch.pvm_power_charge_<id>`, `grid_min` und `grid_deadline` (am Auto-Gerät).
- Die Übersichts-Seite zeigt einen **animierten Energiefluss** (PV → Haus →
  Netz → Geräte) mit Live-Werten und Statusfarben; jede Kachel ist verlinkt
  (keine kryptischen IDs, sondern klickbare Namen). Unter dem Fluss steht
  **jedes Gerät als eigene Box** mit seiner **echten Leistung** (Sensor)
  oder **geschätzten Leistung** („~ …“, wenn es ohne Sensor läuft und PVM
  die Nenn-/Heizleistung kennt) – die Boxen sind modular und wachsen mit
  der Gerätezahl mit (auch 10er/100er-Setups bleiben übersichtlich).

## Services (für Automationen)

| Service | Beschreibung |
| --- | --- |
| `pvm.power_charge` | Power Charge an/aus (`entity_id` + `charge`). |
| `pvm.set_priority` | Priorität setzen (`entity_id` + `position`). |
| `pvm.set_deadline` | Frist-Ziel setzen (`time` + `target_soc`). |
| `pvm.clear_deadline` | Frist-Ziel löschen. |
| `pvm.scan_devices` | Gerätesuche starten. |
| `pvm.rebuild_dashboard` | Seite in der Seitenleiste neu registrieren (nach Problemen). |
| `pvm.run_self_test` | Selbsttest (Meldung mit Problemen). |

**Tipp:** Bei den Services wählst du im Feld „Gerät“ einfach eine beliebige
Entität des gewünschten PVM-Geräts (z. B. dessen Status-Sensor).
