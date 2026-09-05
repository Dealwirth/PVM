# Changelog

Alle wichtigen Änderungen an diesem Projekt werden hier dokumentiert.

## [1.9.6] – 2026-09-05

### README – Header wie bestellt
- **PVM-in-HACS-Button:** Seitenbreiter, ~1 cm hoher Banner in
  Home-Assistant-Blau (#03a9f4) – von einer Seite zur anderen, nicht zu
  übersehen.
- **Logo oben rechts:** neben der Überschrift statt mittig; Größe bleibt
  unverändert (84 px).

### Verifikation
- Komplette Sandbox-Durchklick erneut: Einführung → Übersicht,
  Geräte, Auto/Manuell-Umschaltung (Menü klappt sofort auf), Regler
  speichern, Statistik-Chart (11 SVG-Pfade), Gefunden-Gruppen,
  Einstellungen – ohne Fehler.
- 125 Tests grün, ruff/compileall/node --check sauber.

## [1.9.5] – 2026-09-05

### Diagramm & Cache – „es geht immer noch nicht“ dauerhaft behoben
- **Cache-Buster:** Die PVM-Seite wird jetzt mit Versions-Parameter
  (`panel.js?v=1.9.5`) ausgeliefert. Nach einem HACS-Update lädt der
  Browser garantiert die **neue** Version – zuvor zeigten alte Caches
  wochenlang die fehlerhafte Seite.
- **Historie mit Fallback-Kaskade:** Der Verlauf wird direkt aus dem
  HA-Recorder geladen (wie HA selbst) – erst `history/history_during_period`,
  dann automatisch `recorder/…`. Auf jeder HA-Version funktioniert so eines
  der beiden Kommandos; klappt keines, erscheint eine verständliche
  Hinweismeldung statt „unknown Error“ oder leerer Fläche.

### PV-Prognose jetzt zwingend API-gebunden
- PVM fragt nur noch den Open-Meteo-**Kunden-Endpunkt**
  (`customer-api.open-meteo.com`) ab – **ohne eigenen API-Schlüssel wird
  nicht mehr abgefragt** (der anonyme Endpunkt war unzuverlässig).
- In den Einstellungen steht jetzt eine **exakte Anleitung mit Direktlink**
  (Tarif wählen → Schlüssel sofort erhalten → eintragen → aktualisieren);
  die Statistik-Seite zeigt dieselbe Hilfe, solange der Schlüssel fehlt.

### Gefunden-Liste wird gespeichert + aufklappbar
- Das Scan-Ergebnis („Gefunden“) bleibt jetzt **dauerhaft gespeichert** –
  nach einem Neustart ist kein erneutes Suchen nötig; bereits übernommene
  Vorschläge blendet PVM automatisch aus.
- Die Funde erscheinen als **aufklappbare Gruppen-Zeilen** (Messungen /
  Geräte & Verbraucher) mit allen Entitäten im Detail.

### Bedienung & Startverhalten
- Nach dem Umschalten auf **Manuell** klappt PVM das Bedien-Menü der Karte
  **sofort auf** – Regler und Knöpfe sind ohne weiteren Klick nutzbar.
- Einrichtung abgeschlossen → PVM öffnet **immer direkt die Übersicht**.

## [1.9.4] – 2026-09-05

### Statistik repariert: „unknown Error“ behoben
- **Falsches WebSocket-Kommando:** PVM fragte die HA-Historie über
  `recorder/history_during_period` ab – dieses Kommando existiert nicht,
  HA antwortete mit „unknown Error“ und das Diagramm blieb leer. Jetzt nutzt
  PVM das korrekte `history/history_during_period` – die Diagramme füllen
  sich mit echten Werten direkt aus dem Home-Assistant-Recorder (wie das
  HA-Verlaufs-Diagramm, in ein eigenes Diagramm mit Modi und Reihenwahl).

### Geräte-Steuerung: komplett über den Manager
- **Neuer `pvm/control`-Weg:** Auto/Manuell, Start/Stopp, Ein/Aus und alle
  Regler laufen jetzt über ein Backend-Kommando des Managers statt über
  direkte Service-Aufrufe aus der Seite. Vorteile: die Steuerung funktioniert
  auch, wenn die Schalter-Entität noch nicht registriert ist; die Antwort
  enthält immer eine verständliche Meldung; Werte werden weiterhin an die
  echten Entitäts-Grenzen angepasst (kein „out_of_range“).
- **Karten reagieren sofort:** Der Auto/Manuell-Schalter und das Ausklapp-
  menü aktualisieren sich direkt nach dem Umschalten (vorher blieb der
  Zustand optisch stehen, bis zur nächsten Aktualisierung).
- **Behoben: fehlender „change“-Listener** – Regler-Änderungen im
  Ausklappmenü wurden nicht gespeichert, weil das Änderungs-Ereignis nie
  an kam. Jetzt wird jeder Wert sofort übernommen.

### PV-Prognose: einrichtungsgefragt & sofort aktiv
- **Standort-Frage bei der Einrichtung:** „Steht deine PV-Anlage am Standort
  deiner Home-Assistant-Installation?“ – bei „Ja“ schaltet PVM die Prognose
  ein und rechnet sofort mit den HA-Koordinaten los (Open-Meteo, kostenlos,
  **ohne API-Schlüssel**). Bei „Nein“ führt der Weg zu den Einstellungen.
- **Koordinaten-Überschreibung optional:** Wer seine PV woanders stehen
  hat, kann Breiten-/Längengrad in den Einstellungen hinterlegen.
- **API-Schlüssel-Anleitung in der Seite:** Schritt-für-Schritt-Hinweis
  (open-meteo.com → Forecast API → Schlüssel kopieren) plus Button
  „Prognose jetzt aktualisieren“ – nach Eintrag des Schlüssels wird die
  Prognose sofort neu berechnet statt erst im 15-Minuten-Takt.
- Prognose bleibt standardmäßig aus – sie erscheint erst nach der
  Einrichtungsfrage oder dem Einschalten in den Einstellungen.

### Energie-Sensoren automatisch finden (mit Prüf-Hinweis)
- **Neuer „Automatisch finden“-Button** in den Energie-Sensoren: PVM
  durchsucht alle Entitäten, schlägt passende Messungen vor und zeigt sie
  in einem Dialog zur Bestätigung – mit klarem Hinweis, dass du kurz
  prüfen sollst, ob es die richtigen Sensoren sind.
- **Plausibilitätsprüfung gleich mit:** Zählerstände (kWh) werden als
  unpassend markiert („liefert einen Zählerstand statt einer Leistung“),
  bevor sie die Anzeige kaputt machen können. Schon belegte Plätze werden
  nie stillschweigend überschrieben.

## [1.9.3] – 2026-09-05

### Neues PVM-Logo (Markenauftritt)
- **Eigenes Firmenlogo** (Solarpanel + Sonne + „PVM“-Wortmarke) ersetzt die
  alte Sun-Bolt-Grafik – als `icon.png` / `logo.png` im Projekt (HACS zeigt
  es als Integration-Icon, README im Kopf) und **eingebettet in der
  PVM-Seite** (Kopf der Übersicht, in hellen wie dunklen Themes lesbar).
- Die Seite bleibt vollständig autark: Das Logo liegt als Data-URI direkt
  in `panel.js` – kein externer Dateizugriff nötig.

## [1.9.2] – 2026-09-05

### Geräte-Steuerung repariert („out_of_range“)
- **Temperatur-/Leistungs-Werte werden jetzt an die echten Grenzen der
  Entität angepasst:** Viele Zähler (z. B. Viessmann) erlauben nur einen
  kleinen Bereich – PVM lasest Min/Max/Schrittweite direkt aus der Entität
  und rastet den Zielwert darauf ein. Werte wie „65 °C auf eine 30–70 °C-
  Entität“ können nicht mehr abgelehnt werden. Betroffen waren sowohl die
  Automatik (Wärmepumpe schrieb alle 30 s Fehlermeldungen ins Log) als auch
  die manuellen Regler im Ausklapp-Menü – deren Schieber folgen jetzt
  ebenfalls den echten Entitäts-Grenzen.
- **Fehler-Cooldown:** Schlägt ein Schreibzugriff trotzdem fehl, pausiert
  PVM diese Entität 15 Minuten statt sie bei jedem Zyklus erneut zu
  belasten – das Log bleibt lesbar.

### Statistik: echte Live-Grafiken statt „Bild“
- **Verlauf lädt jetzt wirklich:** Die Zeitstempel der HA-Historie werden
  korrekt gelesen (Felder `lu`/`lc` der Recorder-Antwort) – vorher blieb
  das Diagramm leer bzw. zeigte nur die Achsen. Bei genau einer Entität
  antwortet HA mit einer nackten Liste – auch das wird abgefangen.
- **Einheiten korrekt:** kW-Sensoren werden × 1000 gerechnet (ein
  „4,8 kW“-Wallbox-Zähler taucht nicht mehr als „5 W“ auf) – die Kurven
  zeigen die tatsächlichen Leistungen. Das große Störbild (Icon ohne Größe
  renderkte seitenbreit) ist behoben.

### PV-Prognose: optional, mit eigenem API-Schlüssel
- **Standardmäßig aus:** Die Prognose erscheint erst nach dem Einschalten
  unter *Einstellungen → PV-Prognose & smartes Laden*.
- **Eigener API-Schlüssel (optional):** Wer einen Open-Meteo-Schlüssel
  besitzt, kann ihn zusätzlich hinterlegen – die Abfrage läuft dann als
  Kunden-Anfrage. Ohne Schlüssel bleibt es bei der anonymen Abfrage; ganz
  offline nimmt PVM das lokale Modell.
- **Wolken-Frühwarnung:** Steht in den nächsten 15 Minuten ein Einbruch
  bevor, zeigt der Statistik-Reiter einen orangefarbenen
  Benachrichtigungspunkt – wie eine App-Badge.

### Startverhalten wie eine App
- **Übersicht statt Einführung:** Ist die Einrichtung abgeschlossen, öffnet
  PVM immer direkt die Übersicht – nur beim allerersten Start erscheint die
  Einführung.
- **Benachrichtigungspunkte an den Reitern:** Noch offene Punkte (Einführung,
  fehlende Geräte, fehlende Energie-Sensoren) werden als roter Punkt am
  jeweiligen Reiter markiert – auf einen Blick sichtbar, wie bei einer App.

## [1.9.1] – 2026-09-04

### Review-Runde: Vorausschauendes Laden & Statistik-Feinschliff
- **„Vorausschauendes Laden“ funktioniert jetzt wirklich:** Hat das zugeordnete
  Auto eine **aktive Frist** (Ziel bis Uhrzeit), hält PVM die Wallbox über eine
  kurze Wolkenphase an, statt sie abzuschalten – die Prognose sagt, wann die
  Sonne zurückkommt. Ohne Frist fahren Wallboxen weiter live herunter (kein
  unnötiger Netzbezug durch Halten). Gilt für Wallboxen mit und ohne
  Leistungs-Begrenzer (3 neue Engine-Tests).
- **Statistik-Reihen bleiben sichtbar:** Abgewählte Reihen werden jetzt
  ausgegraut angezeigt statt ganz zu verschwinden – ein Klick holt sie zurück,
  ohne erst den Modus wechseln zu müssen.
- **Prüf-Sandbox zeigt immer eine Sonnenkurve:** Verlauf und Prognose rechnen
  mit fester „Solarzeit“ (jetzt = 11 Uhr) – auch abends/nachts bleibt die
  Demo aussagekräftig.

## [1.9.0] – 2026-09-04

### Marke & Oberfläche
- **Seitenleiste heißt jetzt schlicht „PVM“** – mit eigenem **PVM-Logo** im Kopf
  der Seite, in der Seitenleiste und als Projekt-/HACS-Icon (`icon.png`).
- **Energie-Sensoren mit Haken & Details:** verbundene Messungen tragen einen
  grünen **✓ Verbunden**-Haken; ein Klick auf die Karte klappt Details auf
  (Entität, Messwert, Sensor wählen/entfernen).
- **Übernehmen schützt deine Werte:** Beim Übernehmen einer gefundenen Messung
  prüft PVM Anschluss-Variante und Einheit – ein kWh-Zählerstand wird z. B.
  abgelehnt statt die PV-Anzeige zu zerstören; nichts wird stillschweigend
  überschrieben.

### Statistik & PV-Prognose
- **Neuer Reiter „📊 Statistik“:** Leistungs-Charts (PV, Haus, Netz(bezug/-
  einspeisung), Wallboxen, Geräte) als Fläche oder Linie, 24 h / 7 Tage, mit
  **Modi** (Alles, Nur PV, Verbraucher, Wallboxen, Netz) und **einzeln
  an-/abwählbaren Reihen**; Farben folgen Design und Wunschfarbe.
- **PV-Prognose:** erwartete Leistung **jetzt, in 15 Minuten, nächste 3 h und
  Rest des Tages** – anonym über Open-Meteo (keine persönliche API) mit lokalem
  Modell als Fallback. PVM nutzt sie zum **vorausschauenden Halten**: kurze
  Wolkenphasen führen nicht mehr zum Abschalten (die Heizung flackert nicht),
  und bei Sonne wird untertags geladen, wenn der Überschuss reicht.

### Energiefluss & Geräte
- **Jedes Gerät ist eine eigene Box** unter dem Energiefluss – mit **echter
  Leistung** (Sensor) oder **geschätzter Leistung** („~ …“) und automatisch
  mitwachsendem Raster (auch für viele Geräte).
- **Energiefluss-Layout korrigiert:** Beschriftungen sitzen jetzt mittig auf den
  Verbindungen (Eigenverbrauch, Netzbezug/Einspeisung, Überschuss); Knoten ohne
  Sensor zeigen „–“ statt 0 W.
- **Auto | Manuell direkt auf der Gerätekarte** mit kleinem Ausklapp-Menü
  (Ein/Aus, Start/Stopp, Leistungs-Begrenzer, Ziel-Temperatur). Der Inhalt
  wechselt sofort ohne Neuladen; Regler speichern ihren Wert live.
- **Temperatur-Regler mit Zonen:** farbige Skala mit Strichen – rot unter
  55 °C (Bakterien-/Legionellen-Gefahr), grün 55–70 °C, rot über 70 °C. Das
  **Notfall-Minimum der Wärmepumpe startet bei 60 °C** (einstellbar ab 60).

### Technik
- **Kalibrier-Testlauf komplett entfernt** (Modul, Services, Entitäten, UI) –
  die automatische Leistungsmessung der Wärmepumpe entfällt; wer mag, trägt
  die Heizleistung als Schätzwert ein.
- Ein Klick-Fehler behoben: Die Auto/Manuell-Knöpfe der Gerätekarten kollidierten
  mit der Modus-Auswahl der Einstellungen (dort landete der Klick statt auf der
  Karte) – jetzt getrennte Attribute, inkl. Test im Prüf-Sandbox.

## [1.8.0] – 2026-09-04

### Bedienung & neue Steuerungsarten
- **Auto & Wallbox: automatische Erkennung jetzt abschaltbar.** Neu unter
  **Einstellungen → Steuerung**: „Automatische Auto-Erkennung“ (Standard:
  **aus**). Ist sie an, erkennt PVM über Einsteck-Zeitpunkt und
  Ladeleistung, welches Auto an welcher Wallbox hängt, und lernt die
  Zuordnung. Ist sie aus (Standard), nutzt PVM nur die manuell gewählte
  Heimat-Wallbox im Auto – nichts wird automatisch gelernt.
- **Automatik / Manuell-Schalter.** Neuer großer Umschalter in den
  Einstellungen: **Automatik** verteilt den Überschuss selbst,
  **Manuell** misst PVM nur noch mit und lässt alle Geräte in Ruhe.
- **Steuerung umgebaut (Wallbox & alle Geräte):** Die Auswahl ist jetzt
  „Ein Schalter“ oder „Zwei Taster“ plus ein eigenes Feld
  **„Leistungs-Begrenzer vorhanden“** – dein Gerät (z. B. zwei Taster +
  Leistungsbegrenzer) lässt sich damit genau abbilden. Die zwei
  Schieberegler (maximale Leistung + Mindest-Überschuss) stehen direkt im
  Dialog.
- **Wärmepumpe: „Nur Ziel-Temperatur“ (ohne Ein/Aus).** Viele Wärmepumpen
  lassen sich nicht schalten – nur die gewünschte Speichertemperatur
  einstellen. PVM kann das jetzt: Bei genügend Überschuss wird die
  Ziel-Temperatur angehoben („Ziel bei Überschuss“), bei zu wenig wieder
  auf die normale Soll-Temperatur zurückgestellt. Die Auto-Erkennung
  schlägt diese Steuerungsart selbst vor, wenn eine einstellbare
  Temperatur gefunden wird.
- **Schieberegler zeigen jetzt immer ihren Wert.** Jeder Regler im
  Geräte-Dialog zeigt die aktuelle Zahl direkt an (vorher stand nur die
  Einheit daneben – man musste raten).
- **Zusatz-Infos sind eingeklappt.** Lange Beschreibungstexte in den
  Geräte-Dialogen stecken hinter einem **ⓘ**-Symbol und klappen erst auf,
  wenn du sie brauchst – die Dialoge wirken dadurch aufgeräumter.

### Fehler & Anzeige
- **„Gefundene Messungen übernehmen“ funktioniert jetzt sichtbar.** Vorher
  lud die Seite nach dem Klick nur neu und der Eintrag blieb stehen – der
  übernommene Vorschlag verschwindet jetzt sofort aus der Liste und wird
  als übernommen bestätigt.
- **Wallbox zeigt keinen Akku-Stand mehr.** Der Akku gehört zum Auto – die
  Wallbox-Karte zeigt nur Leistung, zugeordnetes Auto und Ziel. (Die
  Wattpilot-„Prozentanzeige“ ohne eigenen Sensor ist damit weg.)
- **Fehlende Daten werden ausgeblendet statt erfunden.** Die Auto-Karte
  zeigt den Akku-Stand nur, wenn ein SoC-Sensor wirklich einen Wert
  liefert – sonst erscheint gar keine Akku-Leiste.
- **PV-/Netz-Sensoren wirken wieder zuverlässiger:** Der Überschuss wird in
  der Anzeige direkt aus den Sensoren berechnet (nicht aus einem
  veralteten Zykluswert), und Messwerte gelten länger als frisch
  (5 Minuten statt 90 s) – langsam aktualisierende Zähler (z. B. Modbus)
  „verschwinden“ nicht mehr ständig.
- **Leistungs-Begrenzer-Modell vereinheitlicht:** Alte „Schalter + Limit“
  Steuerungen werden automatisch auf das neue Modell umgestellt
  (Schalter + „Leistungs-Begrenzer vorhanden“).

## [1.7.1] – 2026-09-04

### Fehleranalyse & Verbesserungen („Alles nochmal geprüft“)

**Gefundene und behobene Fehler:**
- **Wärmepumpe wurde bei kurzzeitig ungültiger Temperatur abgeschaltet.**
  Meldet der Temperatur-Sensor nur alle paar Minuten (z. B. alle 15 min),
  galt die Messung zwischendurch als „ungültig“ – die WP wurde dann
  ausgeschaltet statt gehalten. Jetzt bleibt ein laufender Heizvorgang mit
  Messwert an (analog zum Auto ohne gültigen SoC); nur ohne Überschuss
  wird abgeschaltet. (Neue Engine-Tests.)
- **Wallbox ohne SoC-Sensor lud nie.** Eine Wallbox ohne Auto- und ohne
  SoC-Sensor bekam automatisch die (leeren) Auto-Ziele – die Engine
  startete sie deshalb nie. Jetzt erkennt PVM: ohne SoC-Quelle fällt die
  Wallbox auf reines Überschuss-Laden wie ein Verbraucher zurück.
- **Vorzeichen-Auswahl des Netz-Sensors wurde nicht gespeichert.** Die
  Wahl „Bezug positiv / Einspeisung negativ“ usw. änderte nur den
  Zwischenspeicher und ging beim nächsten Neuladen verloren – sie wird
  jetzt sofort gespeichert (in der Sandbox verifiziert).
- **`pvm.set_priority` zählte Autos als Position.** Der Service zählte die
  Priorität über alle Geräte inkl. Autos – inkonsistent zu Rang-Sensor,
  Pfeilen und `move_priority`. Jetzt zählen nur steuerbare Geräte; Autos
  werden abgelehnt (sie haben keine Priorität).
- **Auto-Ziele fehlten als Entitäten.** Seit der Trennung von Auto & Wallbox
  gab es für das Auto keine `number`/`time`/`switch`-Entitäten
  (Mindest-/Max-SOC, Frist-Ziel, Power Charge, Netz-Freigaben) – nur die
  Wallbox hatte sie. Jetzt gehören sie zum Auto-Gerät (auch für
  Automationen), die alten Wallbox-Entitäten bleiben als Fallback erhalten.

## [1.7.0] – 2026-09-04

### Auto & Wallbox getrennt – Einstellungen beim Auto, automatische Kopplung
- **Wallbox-Dialog aufgeräumt:** Die Wallbox braucht nur noch Leistungs-Sensor
  und Steuerung. Akku-Grenzen, Frist-Ziele, Power Charge und Netz-Freigaben
  sind daraus entfernt – die stellst du jetzt **am Auto** ein („Wo ist dieses
  Auto zu Hause?“ koppelt es automatisch mit der Wallbox).
- **Wallbox nutzt die Ziele des zugeordneten Autos:** Die Engine liest für die
  Lade-Entscheidung die Werte des Autos, das gerade an der Wallbox hängt
  (Live-Zuordnung oder gelernte Heimat-Wallbox); Alt-Konfigurationen ohne
  Auto-Gerät funktionieren weiter (Fallback auf die bisherigen Wallbox-Werte).
- **Weniger überladen:** Selten genutzte Optionen stecken im Geräte-Dialog
  unter „Erweiterte Einstellungen“ (aufklappbar) – Wallbox, Wärmepumpe und
  Auto zeigen nur noch die wichtigen Felder, nichts geht verloren.
- **Wallbox-Karte zeigt das Ziel des Autos:** Die Ziel-Kachel („Ziel … %“)
  kommt vom zugeordneten Auto, nicht mehr von der Wallbox.

### Einfacher Einstieg & saubere Deinstallation
- **README-Button:** Großes, randloses blaues Pill-Symbol „PVM in HACS“ –
  nur blaue Fläche, klickbar, HACS öffnet die Einrichtung direkt.
- **Deinstallation räumt wirklich auf:** Wird PVM entfernt, wird die
  gespeicherte Konfiguration auch dann gelöscht, wenn der Manager schon
  entladen ist – es bleibt nichts von PVM zurück. (Die Einstellungen bleiben
  gespeichert, solange die Integration installiert ist.)

## [1.6.2] – 2026-09-04

### Design-Auswahl repariert & freie Farbe
- **„Sonnenaufgang“ funktioniert jetzt wirklich:** Das Design hatte seit jeher
  keine eigenen Farben – die Auswahl tat optisch nichts. Neues warmes
  Sonnenaufgang-Design (dunkel, Orange/Gold) mit passendem Hintergrundverlauf.
- **Deine Farbe ersetzt das HA-Blau:** Unter **Einstellungen → Design →
  Deine Farbe** bestimmst du jetzt die Hauptfarbe (Knöpfe, Verläufe,
  Fortschritt, Details) – vorher war nur eine kaum sichtbare zweite
  Verlaufsfarbe wählbar. Die Wahl wirkt in allen vier Designs.
- **Eigene Farbe (freies Farbfeld):** Zusätzlich zu den Vorgaben (Grün,
  Orange, Lila, Rot, Türkis, Blau) gibt es „Eigene Farbe …“ mit beliebigem
  Hex-Wert. Wird gespeichert und überlebt Neustarts; ungültige Werte fallen
  automatisch auf „Automatisch“ zurück.
- **Design-Menü bleibt offen:** Die Einstellungs-Akkordeons merken sich ihren
  Zustand – die Auswahl klappt nach dem Speichern nicht mehr von selbst zu.
- Design-Wahl wird direkt über den Panel-Speicherweg persistiert und ist
  damit nicht mehr von der select-Entität abhängig (robuster, auch wenn die
  Entität noch nicht existiert).

## [1.6.1] – 2026-09-04

### Design & Code-Aufräumrunde
- **Kopfbereich im HA-Stil:** Der Panel-Kopf ist jetzt eine kompakte
  „App-Bar“-Karte (weiße Karte, Logo, Live-Chips, Zurück-zu-HA-Button) –
  folgt deinem HA-Theme inkl. hell/dunkel.
- **Tabs als segmentierte Leiste:** Navigation im HA-Chip-Stil; auf breiten
  Bildschirmen eine gleichmäßige Zeile, auf schmalen Fenstern bricht sie
  sauber um statt abzuschneiden.
- **Kleberei in der Einführung korrigiert:** Der Zähler unter „Geräte
  hinzufügen“ nennt jetzt auch mit Autos die richtige Zahl (z. B.
  „1 + 1 Auto Geräte konfiguriert“ statt einer irreführenden Zahl).
- **Toter Code entfernt:** Die veraltete automatische Entitäten-
  Neuauslösung im Manager (`_schedule_entity_reload`/`_devices_changed`)
  ist entfernt – den Entitäten-Reload löst seit 1.5.0 ausschließlich das
  Panel gezielt aus. Kein Doppel-Reload, weniger Verwirrung.

## [1.6.0] – 2026-09-04

### Auto ↔ Wallbox: Einsteck-Zeitpunkt + gelernte Zuordnung
- **Erkennung über den Einsteck-Zeitpunkt:** Beginnt die Ladeleistung einer
  Wallbox und eines Autos im selben Moment, kombiniert PVM beides und
  **speichert** die Zuordnung dauerhaft (Heimat-Wallbox des Autos). Damit weiß
  PVM auch nach Neustarts, welches Auto an welcher Wallbox hängt.
- **Individuell einstellbar:** Im Auto-Dialog gibt es die Auswahl „Wo ist
  dieses Auto zu Hause?“ (Wallbox wählen oder „Automatisch – PVM lernt es
  selbst“). Wallbox-Karten zeigen das ladende Auto (🚗) bzw. das gelernte
  (🏠 „zu Hause“); der Auto-Status-Sensor liefert zusätzlich
  `home_wallbox_id`/`home_wallbox_name`.
- **Rückfall für „nur ein Auto“:** Lädt genau eine Wallbox und es gibt nur ein
  Auto (ohne eigene Leistungsmeldung), ordnet PVM es der gelernten Wallbox zu.

### Bedienung & Dashboard
- **Geräte-Karten sind antippbar** – ein Klick auf die Karte öffnet alle
  Details und Einstellungen (vorher nur über den ✏️-Button).
- **Eigene Eingaben statt nur Auswahl:** Entitäts-Felder im Dialog sind jetzt
  frei tippbar („Entitäts-ID tippen oder wählen“); getippte Werte bleiben auch
  beim Zurück-/Weiter-Blättern erhalten.
- **Einführung (Tutorial):** großes „🎉 Einführung beenden“, sobald alles
  eingerichtet ist – danach verschwinden die Schritte und das Dashboard ist
  aufgeräumt (kleiner „Einführung überspringen“-Link, wenn noch etwas fehlt;
  „erneut ansehen“ jederzeit möglich).
- **Akzentfarbe (2. Farbe):** unter Einstellungen → Design & Darstellung
  wählbar (Automatisch/Grün/Orange/Lila/Rot/Türkis/Blau) – passt Verläufe,
  Fortschritt und Details an; hell/dunkel folgt weiterhin dem HA-Theme.
- **Reihenfolge-Pfeile korrigiert:** Autos belegen keinen Rang mehr – Anzeige,
  Nummerierung, Pfeile und Backend (Engine-Priorität, Rang-Sensor) zählen nur
  noch steuerbare Geräte. Vorher verschoben die Pfeile unsichtbar Autos mit.

### Behoben
- Frei getippte Entitäts-IDs gingen beim Seitenwechsel im Geräte-Dialog
  verloren (jetzt werden die Felder vor jedem Schrittwechsel übernommen).

## [1.5.0] – 2026-09-04

### Behoben – „Geräte hinzufügen“ reagierte nicht (wirkliche Ursache gefunden)
- **Der Geräte-Dialog war komplett „taub“:** Beim Öffnen eines Dialogs wurde
  der Geräte-Dialog-Zustand gelöscht, wodurch jeder Klick (Typ wählen, Weiter,
  Speichern) still verworfen wurde. Dialoge sind jetzt **stapelbar**
  (Entitäten-Picker öffnet sich über dem Dialog, ohne ihn zu zerstören), und
  der Dialog-Zustand bleibt erhalten, bis der Dialog wirklich geschlossen ist.
- **Seite blieb nach erneutem Öffnen auf „verbindet …“ hängen:** Wurde das
  Panel-Element neu erzeugt (Seite erneut geöffnet), zeigte es endlos den
  Ladebildschirm. Jetzt erscheint sofort der letzte Stand und die Seite lädt
  parallel frische Daten – mit Endlos-Retry statt Endlos-Hänger.
- **Geräte-Umbenennen löst den Entitäten-Reload korrekt aus** (Entität
  „Status/Prio“ folgt dem Namen), reine Wertänderungen bleiben sofort wirksam
  ohne Reload. Reload und Speichern laufen deterministisch über das neue
  WebSocket-Kommando `pvm/reload` – kein doppelter Reload mehr.

### Neu – „Dein Netzanschluss“ (kombiniert ↔ getrennt) hält jetzt wirklich
- Die Umstellung **ein Sensor ↔ zwei getrennte Sensoren** wird im
  Konfigurations-Modell gespeichert und bleibt nach Reload/Neustart/Neueröffnung
  erhalten – vorher wurde die Auswahl stillschweigend wieder zurückgesetzt.
- **Vorzeichen-Auswahl für kombinierte Zähler** („Bezug positiv (+), Einspeisung
  negativ (−)“, „Invertiert“, „Nur Einspeisung“) – passt z. B. für Zähler, die
  die Einspeisung positiv liefern.
- Die Berechnung (Überschuss, Energiefluss, Kacheln) folgt Modus und Richtung
  durchgängig; neue Tests decken beide Varianten ab.

### Prüf-Sandbox & Qualität
- **Neue Prüf-Sandbox** (`sandbox/`): führt die echte Panel-Seite gegen einen
  simulierten Home-Assistant-WebSocket aus. Damit wurden Umstellung,
  Geräte-Anlage/-Bearbeitung/-Löschung und die Auto-Zuordnung („lädt an
  Wallbox“ ↔ „unterwegs“) im Browser durchgeklickt und verifiziert.
- Übersichtlichere Geräteverwaltung: verständliche Gerätetypen, klare
  Steuerungsarten mit Erklärtext, Vorfüllung beim Bearbeiten, deutsche
  Formulierung – inklusive Formfehler-Korrekturen.
- README/Doku: Installations-Button größer & auffälliger, Doku zur
  Netzanschluss-Wahl, Sandbox-Anleitung für Entwickler.

## [1.4.0] – 2026-09-04

### Behoben – „Geräte hinzufügen hängt / Seite lädt nicht weiter“ (komplett überarbeitet)
- **Speichern blockiert nie mehr:** Die Konfiguration wird sofort übernommen und
  die Antwort kommt ohne Wartezeit. Neue/entfernte Geräte werden **entprellt im
  Hintergrund** nachgeladen (ein Reload statt vieler, geschützt gegen
  Überschneidungen) – die Seite rendert danach zuverlässig neu und holt die
  neuen Entitäten automatisch nach.
- **Kein stilles Aufgeben mehr:** Früher gab die Seite nach ~15 Sekunden auf,
  ohne etwas anzuzeigen („es lädt nicht weiter“). Jetzt wird nach jedem
  Speichern garantiert neu gerendert – notfalls mit deutlicher Meldung.
- **Scan mit Sperre + Zeitlimit:** Doppelte Scans laufen nicht mehr parallel;
  die Suche antwortet immer (max. 60 s) und der Button wird zuverlässig wieder
  aktiv. WebSocket-Kommandos antworten bei Fehlern mit klarer Meldung statt zu
  hängen.
- **Bearbeiten nachträglich funktioniert wirklich:** Schalter wie „Netz für
  Mindest-SOC“, „Netz für Frist-Ziel“, „Netz im Notfall“ und „Power Charge“
  schrieben bisher auf einen falschen Konfigurations-Schlüssel und gingen
  verloren – jetzt korrekt gespeichert. Die Wallbox-Bearbeitung bietet
  zusätzlich **Zeit-Ziel (SOC + Uhrzeit)** und **Power Charge** an.

### Hinzugefügt – Netzbezug & Einspeisung getrennt (dein Wunsch)
- **„Dein Netzanschluss“-Auswahl** in den Energie-Einstellungen: „Ein Sensor
  (Bezug + / Einspeisung −)“ **oder** „Zwei getrennte Sensoren“ – passend zu
  SolarNet & Co. mit separaten Zählern. PVM zeigt nur die passenden Felder,
  der Wechsel ist jederzeit möglich.
- **Eigene Kacheln „Netzbezug“ und „Einspeisung“** in Übersicht und Start-Seite
  sowie saubere getrennte Anzeige im Energiefluss (↓ Bezug / ↑ Einspeisung).
- Ist nur der Bezug bekannt (Einspeisung fehlt/ungültig), gilt der Überschuss
  als **unbekannt** statt fälschlich „0“ – die Engine hält den Zustand sicher.
- Neue, getestete, reine Berechnungsfunktion `compute_energy_flow` für alle
  Sensor-Kombinationen (10 neue Tests).

### Verbessert (Dashboard & Stabilität)
- **Beschriftungen „springen“ nicht mehr:** Live-Werte reservieren feste
  Breiten (Kopf-Chips, Kacheln), Karten nutzen `auto-fit`, lange Namen
  brechen sauber um – auch auf großen Monitoren ruhig und aufgeräumt.
- Beim Öffnen der Seite wird während eines Reloads automatisch erneut
  verbunden (keine sofortige Fehlerseite).
- Automatischer Scan beim Start nur noch bei frischer Installation (ohne
  Benachrichtigung) – kein lästiges Wiederholen nach Neustarts.

### Dokumentation
- **README komplett neu** als kompaktes Anwender-Handbuch: Inhaltsverzeichnis
  als nebeneinanderliegende, mitwachsende Kacheln, Entwickler-Abschnitt
  entfernt (Verweis auf `docs/`), FAQ-Details und KI-Support nach
  `docs/faq.md` verschoben.
- Alle `docs/*.md` haben oben einen **„Zurück zum README“**-Link; die
  Konfiguration beschreibt die neue Netzanschluss-Auswahl und das
  HA-Design als Standard.

## [1.3.1] – 2026-09-04

### Behoben / Verbessert
- **Beim Löschen der Integration wird alles automatisch entfernt:** Die eigene
  PV-Manager-Seite verschwindet aus der Seitenleiste (inkl. altem
  Lovelace-Dashboard), die gespeicherte Konfiguration und die
  PVM-Benachrichtigungen werden gelöscht – kein verwaister Eintrag mehr.

## [1.3.0] – 2026-09-04

### Behoben
- **„Geräte können nicht hinzugefügt werden / es lädt nicht weiter“:** Die
  Benachrichtigungen nutzten das in HA 2024.9 entfernte `hass.components`
  (`persistent_notification`). Dadurch schlug die automatische Gerätesuche
  und das Neuladen nach dem Speichern fehl. Jetzt über den offiziellen
  `persistent_notification`-Service – Scan, Übernehmen und Speichern laufen
  wieder zuverlässig durch.
- **Einheiten-Fehler:** Leistungssensoren in `kW`/`mW` (z. B. SolarNet, viele
  Wallboxen) wurden als Watt interpretiert – Überschuss und Zuordnungen waren
  um den Faktor 1000 falsch. Alle Leistungswerte werden jetzt einheiten-korrekt
  in Watt umgerechnet (Backend und Seite).
- Speichern löst keinen „hängenden“ Zustand mehr aus: Die Seite wartet nach
  dem Speichern aktiv, bis die neue Konfiguration geladen ist.

### Hinzugefügt
- **🚗 Autos (E-Autos) als eigene Geräte:** Akkustand (SoC) und aktuelle
  Ladeleistung werden überwacht. PVM ordnet jedes Auto **vollautomatisch**
  der passenden Wallbox zu – Vergleich der Ladeleistungen (eine Wallbox, ein
  Auto → trivial; mehrere → ähnlichste Leistung). Autos, die nicht laden,
  gelten als **unterwegs**; der Status „lädt an Wallbox … / unterwegs“
  erscheint live auf der Seite und als Sensor (`pvm_car_status_*`).
- **Mehr Energiesensoren:** getrennter Netzbezug- und Einspeisung-Sensor,
  Speicher-Leistung und Speicher-SoC – jeweils optional und einzeln
  abwählbar; neue Rollen in der automatischen Erkennung, Speicher-Knoten im
  Energiefluss-Diagramm.
- **Live-Aktualisierung für alle Daten:** Die Seite abonniert
  `state_changed`-Events über WebSocket und aktualisiert zusätzlich jede
  Sekunde – Energiefluss-Diagramm, Gerätekarten, Auto-Zuordnung und Status.
- **„← Home Assistant“-Button** im Kopf: öffnet die Seitenleiste wieder und
  führt zurück zur HA-Startseite (nicht irgendwohin).
- **Design „🏠 Home Assistant“** (neuer Standard): übernimmt automatisch
  Farben, Karten-Ecken und Schatten deines HA-Themes (hell/dunkel); die
  drei festen Stimmungen bleiben als Alternative erhalten.

## [1.2.0] – 2026-09-03

### Hinzugefügt – eigene PV-Manager-Seite (kein Lovelace mehr)
- **Komplett selbst gebaute Oberfläche** (`panel/panel.js`, ~1.900 Zeilen HTML/CSS/JS):
  ersetzt das Lovelace-Dashboard vollständig durch eine eigene Seitenleisten-Seite
  (Mechanik wie HACS: Custom-Panel mit `embed_iframe`, statische Dateien ohne Cache).
- Sechs Reiter: **Erste Schritte** (Mini-Tutorial), **☀️ Übersicht** (animierter
  Energiefluss PV → Haus → Netz → Geräte), **🔌 Geräte**, **⬆️ Reihenfolge**,
  **🔍 Gefunden** (Vorschläge mit Begründung + Live-Wert), **🎨 Einstellungen**
  (aufklappbare Gruppen, Schieberegler, Design-Wechsel mit Animation).
- **Eigene Geräte-Dialoge**: Geräte hinzufügen/bearbeiten/entfernen läuft komplett
  in der Seite – dynamische Felder je Steuerungsart, keine HA-Formulare.
- WebSocket-Kommandos `pvm/get_config`, `pvm/save_config`, `pvm/scan`,
  `pvm/list_entities` für die Seite; jede Speicherung wird validiert.
- Altes Lovelace-Dashboard (`pvm-dashboard`) wird beim ersten Start automatisch
  entfernt; kein Options-Flow und kein Dashboard-Builder/Creator mehr im Code.
- Alle Entitäten bleiben normale HA-Entitäten (für Automationen nutzbar).

### Behoben
- Kryptische Entity-IDs/Nummern in „Links“: Die Seite verlinkt über das
  Entitäten-Mapping (unique_id → entity_id) und zeigt verständliche Namen.
- „expected (sensor)“-Fehler endgültig beseitigt: Auswahlfelder der Seite
  akzeptieren alle passenden Entitätenarten.

## [1.1.0] – 2026-09-03

### Geändert (Dashboard-Zentrale statt Setup-Wizard)
- Kein Installations-Wizard mehr: PVM wird in **einem Klick ohne Fragen** eingerichtet.
- Alles Weitere läuft im **Dashboard**: Start-/Tutorial-Ansicht (Sensoren ablesen, Geräte hinzufügen, Einstellungen), Übersicht, Geräte, Reihenfolge, Einstellungen.
- **Stark verbesserte Auto-Erkennung**: durchsucht Entity- UND Device-Registry aller Integrationen, nutzt Hersteller-/Integrations-Signale (SMA, go-e, openWB, Vaillant …), liefert Kandidaten mit Begründung und fragt bei mehreren Treffern nach.
- **Hybrid-Verwaltung**: Gefundene Sensoren/Geräte werden im Dialog mit Live-Messwert bestätigt und übernommen; manuelle Auswahl bleibt möglich.
- **3 umschaltbare Designs** (☀️ Sonnenaufgang = Standard, 🌿 Natur-frisch, 🌊 Kühl & klar) über einen Design-Select im Dashboard.
- **Steuerung per zwei Tastern** (Start/Stopp) für Wallbox/Wärmepumpe/Verbraucher; Zustand wird über die Ladeleistung erkannt.
- Einstellungen im Dashboard als **aufklappbare Gruppen** (Globale Regeln + je Gerät) mit Schiebereglern; neue Regler (Zykluszeit, Mindestzeiten, Leistungsgrenzen, Notfall-Temperatur).
- **Fehlerfix** „expected (sensor)“: Mess-/Limit-Felder akzeptieren jetzt alle sinnvollen Entitätenarten (sensor/number/input_number, Taster button/switch) mit verständlichen deutschen Meldungen.
- Setup-Status-Sensor (start → messungen → bereit) für das Tutorial.

### Behoben
- Prüfung im Selbsttest berücksichtigt Zwei-Taster-Steuerung.

## [1.0.0] – 2026-09-03

### Hinzugefügt
- Kompletter Neuaufbau der Integration – stabil, getestet und ohne YAML.
- Setup-Wizard mit automatischer Geräteerkennung (Vorschläge werden bestätigt, nichts wird ohne Nutzer angelegt).
- Prioritätenliste mit ▲/▼-Buttons im automatisch erstellten Dashboard.
- PV-Überschussverteilung an Wallboxen, Wärmepumpen und Verbraucher (beliebige HA-Entitäten).
- E-Auto-Laden: Mindest-SOC, Max-SOC, Frist-Ziele („bis 18:00 auf 80 %“) und Power Charge.
- Netzstrom-Verhalten steuerbar (Mindest-SOC/Fristen/Modus „Nur Überschuss“).
- Wärmepumpen-Steuerung mit Soll-/Sicherheitstemperatur und Kalibrierungstest (Aufheizen bis 70 °C, Störungserkennung, Verbrauchsmessung).
- Automatische Dashboard-Erstellung über den HA-eigenen Lovelace-Speicher (idempotent, mit Rebuild-Button/-Service).
- Persistente Konfiguration im JSON-Store, Wiederanlauf-sicher.
- Services für Automationen (Power Charge, Ziele, Priorität, Scan, WP-Test, Selbsttest, Dashboard-Rebuild).
- Diagnose-Export und `run_self_test`-Service.
- Fehlertoleranz: letzte gültige Messwerte, Timeouts, Engine-Neustart, Antiflackern (Mindest-Ein-/Ausschaltzeiten), Hysterese.
- Deutsche + englische Übersetzungen, Dokumentation (`docs/`) und README.
- CI mit hassfest, ruff und pytest (Python 3.12/3.13).

### Behoben (gegenüber früherem Stand)
- Setup-Wizard öffnet zuverlässig und führt vollständig durch.
- Dashboard-Erstellung implementiert (Lovelace-Storage-API statt Platzhalter).
- Keine fehlenden Imports mehr (durch `ruff`/Tests abgesichert).
- Prioritäten werden dauerhaft gespeichert.
- Auto-Erkennung führt echte Vorschläge aus und blockiert nie die Einrichtung.

### Bekannte Einschränkungen
- Die Steuerung erfolgt über Schalter- und Nummern-Entitäten (keine herstellerspezifischen
  Service-Profile – siehe `docs/development.md` für den Erweiterungspunkt).
- Ein echtes „Drag & Drop“ im Dashboard ist mit HA-Standardkarten nicht möglich;
  Prioritäten werden über ▲/▼-Buttons verschoben.
