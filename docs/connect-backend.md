# PVM mit Home Assistant verbinden — Schritt für Schritt

Diese Anleitung erklärt **jeden Schritt**, um PVM zum Laufen zu bringen, und
wie man die HA-URL herausfindet — auch bei **DuckDNS**, Nabu Casa, Docker oder
einem Reverse-Proxy. Sie behebt die typischen Fehler „Server nicht erreichbar“
und „Nicht-lokale HA-URL blockiert“.

## Überblick: Es gibt zwei Verbindungen

PVM besteht aus zwei Teilen, die getrennt verbunden werden müssen:

```
Browser / HA-Panel  ──(1)──►  PVM-Backend  ──(2)──►  Home Assistant
     (UI)                    (Node.js)                (HA-API)
```

| Fehlermeldung                      | Bedeutung                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| „PVM-Backend ist nicht erreichbar“ | Verbindung **(1)** fehlt — der PVM-Server läuft nicht oder ist falsch adressiert. |
| „PVM-016 – Nicht-lokale HA-URL“    | Verbindung **(2)** blockiert — die HA-Adresse ist öffentlich (z. B. DuckDNS).     |
| „PVM-002 – HA nicht erreichbar“    | Verbindung **(2)** fehlt — HA-Adresse/Port falsch oder HA nicht erreichbar.       |
| „PVM-003 – HA-Authentifizierung“   | Der Long-Lived Access Token ist falsch.                                           |
| „PVM-004 – PVM-API-Token“          | Das `PVM_API_SECRET` stimmt nicht.                                                |
| „PVM-022 – HA-Integration“         | PVM erreicht HA nicht direkt und hat noch keine Daten von der HA-Integration.     |

---

## Teil 1 — Das PVM-Backend starten

Wähle **eine** der drei Optionen. Danach ist der PVM-Server unter
`http://<host>:7000` erreichbar.

### Option 0 — Ein Befehl (empfohlen für Einsteiger)

Ein Skript erledigt alles: Secret erzeugen, `.env` schreiben, bauen, starten
(mit Docker, falls vorhanden, sonst mit Node.js).

```bash
git clone https://github.com/Dealwirth/PVM.git
cd PVM
npm run setup          # entspricht: bash scripts/pvm-setup.sh
```

Am Ende zeigt das Skript den **PVM-API-Token** an — diesen brauchst du für die
HA-Integration. Erzwungene Modi und HA-Daten direkt übergeben:

```bash
./scripts/pvm-setup.sh --mode node
./scripts/pvm-setup.sh --mode docker --ha-url http://homeassistant.local:8123 --ha-token eyJ...
```

### Option A — Docker (empfohlen, überall lauffähig)

Voraussetzung: Docker + Docker Compose.

```bash
git clone https://github.com/Dealwirth/PVM.git
cd PVM

# Ein langes, zufälliges Secret erzeugen (das ist später der PVM-API-Token):
export PVM_API_SECRET="$(openssl rand -hex 32)"
# Optional, wenn PVM die HA-URL direkt kennen soll (sonst im Setup-Assistenten):
export HA_URL="http://homeassistant.local:8123"
export HA_TOKEN="<dein Long-Lived Access Token>"

docker compose up -d --build
```

Prüfen, ob das Backend läuft:

```bash
curl http://localhost:7000/api/health
# {"status":"ok","version":"1.0.0","ha":{"connected":false,"url":""},"uptimeSeconds":1}
```

Dann im Browser öffnen: **http://localhost:7000**

> **Wichtig bei Docker:** Läuft Home Assistant auf demselben Rechner (Host),
> erreicht der Container HA über `http://host.docker.internal:8123` — **nicht**
> über `localhost`. `host.docker.internal` ist in der `docker-compose.yml`
> bereits gemappt.

### Option B — Native Node.js (ohne Docker)

Voraussetzung: Node.js ≥ 20, npm ≥ 10.

```bash
git clone https://github.com/Dealwirth/PVM.git
cd PVM

cp .env.example .env
# .env bearbeiten:
#   PVM_API_SECRET  = langes, zufälliges Secret (>= 32 Zeichen)
#   HA_URL          = z. B. http://homeassistant.local:8123
#   HA_TOKEN        = dein Long-Lived Access Token

npm install
npm run build
npm start
# PVM läuft auf http://localhost:7000
```

#### Optional: als Dienst mit Autostart (systemd)

Damit PVM nach einem Neustart automatisch läuft, `/etc/systemd/system/pvm.service`
anlegen:

```ini
[Unit]
Description=PVM (PV-Manager)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/pvm
EnvironmentFile=/opt/pvm/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
User=pvm

[Install]
WantedBy=multi-user.target
```

Aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pvm
sudo systemctl status pvm
```

### Der häufigste Stolperstein: `localhost` ist nicht überall dasselbe

`localhost` bedeutet immer „der Rechner, auf dem der Browser läuft“.

- Läuft der Browser auf **demselben** Rechner wie PVM → `http://localhost:7000`.
- Läuft PVM auf einem **anderen** Rechner (z. B. Raspberry Pi) → verwende dessen
  IP-Adresse, z. B. `http://192.168.1.20:7000`.

Damit das Backend von außen erreichbar ist, muss es auf `0.0.0.0` lauschen
(Standard: `PVM_HOST=0.0.0.0`, Port `PVM_PORT=7000`).

---

## Teil 2 — Die HA-URL herausfinden (inkl. DuckDNS)

PVM verbindet sich **serverseitig** mit Home Assistant. Entscheidend ist also,
dass **der PVM-Server** HA erreichen kann — nicht dein Browser.

### 2.1 Lokales Netzwerk (empfohlen)

1. In Home Assistant: **Einstellungen → System → Netzwerk**.
2. Dort stehen „Interne URL“ und „Externe URL“. Für das lokale Netz nimm die
   interne Adresse:
   - `http://homeassistant.local:8123` (funktioniert nur mit mDNS/Bonjour), oder
   - die **IP-Adresse**: `http://192.168.1.50:8123`.
3. Die IP findest du in HA unter **Einstellungen → System → Netzwerk** oder im
   Router. Die IP ist zuverlässiger als `homeassistant.local`.

### 2.2 PVM in Docker, HA auf dem Host

```
http://host.docker.internal:8123
```

`host.docker.internal` zeigt aus dem Container auf den Docker-Host. Genau
dafür ist der `extra_hosts`-Eintrag in der `docker-compose.yml` da.

### 2.3 DuckDNS (öffentliche HA-Adresse)

DuckDNS gibt deiner HA-Instanz eine feste, öffentliche Domain. So bekommst du
die URL:

1. Auf <https://www.duckdns.org> mit GitHub/Google/… anmelden.
2. Eine Subdomain anlegen, z. B. `meinepvanlage` → ergibt
   **`meinepvanlage.duckdns.org`**.
3. Das **DuckDNS-Add-on** in Home Assistant installieren und dort den
   DuckDNS-Token + die Subdomain eintragen (oder den Router/DynDNS-Client
   entsprechend konfigurieren), damit die Domain auf deine öffentliche IP zeigt.
4. Portweiterleitung im Router einrichten: Port **8123** (oder 443) auf die
   HA-IP weiterleiten.
5. Die fertige HA-URL lautet dann:
   - ohne eigenen Port: `https://meinepvanlage.duckdns.org`
   - mit Port: `https://meinepvanlage.duckdns.org:8123`

> **Wichtig:** `*.duckdns.org` ist **nicht lokal**. PVM blockiert solche
> Adressen standardmäßig (Schutz vor versehentlichem Datenabfluss). Erlaube sie
> einmalig — siehe Teil 3.

**Prüfen, ob die URL stimmt:** Öffne sie im Browser. Es muss die
Home-Assistant-Anmeldeseite erscheinen. Wenn nicht, stimmen Domain oder
Portweiterleitung nicht.

### 2.4 Nabu Casa (Home Assistant Cloud)

```
https://<deine-id>.ui.nabucasa.com
```

Ebenfalls **nicht lokal** → in PVM erlauben (Teil 3).

### 2.5 Eigener Reverse-Proxy (nginx/Caddy, Let's Encrypt)

```
https://ha.example.tld
```

**Nicht lokal** → erlauben. Achte darauf, dass der Proxy WebSocket
(`/api/websocket`) durchreicht.

### 2.6 Kurz: Was trägt man im PVM-Setup ein?

Du musst die HA-URL meist **gar nicht** eintippen: Der HA-Custom-Component
übergibt sie automatisch an PVM. Nur wenn die Erkennung fehlschlägt, öffnest du
im Setup-Assistenten **„Erweitert (HA-URL manuell)“** und trägst die Adresse
ein. Das Schema (`http://` / `https://`) ist optional — PVM ergänzt es
automatisch:

| Eingabe                          | Wird zu                                  |
| -------------------------------- | ---------------------------------------- |
| `homeassistant.local:8123`       | `http://homeassistant.local:8123`        |
| `192.168.1.50:8123`              | `http://192.168.1.50:8123`               |
| `host.docker.internal:8123`      | `http://host.docker.internal:8123`       |
| `meinepvanlage.duckdns.org:8123` | `https://meinepvanlage.duckdns.org:8123` |

---

## Teil 3 — „Nicht-lokale HA-URL blockiert“ (PVM-016) beheben

Die Einstellung **„Nur lokale HA-URL erlauben“** (`HA_LOCAL_ONLY`) schützt
davor, dass HA-Zugangsdaten an eine öffentliche Adresse geschickt werden.
Für DuckDNS/Nabu Casa/Reverse-Proxy muss sie einmalig deaktiviert werden.

**Weg A — direkt im Setup-Assistenten (am einfachsten):**
Erscheint die Meldung PVM-016, klick auf **„Verbinden & speichern“**. PVM
erkennt die öffentliche Adresse, deaktiviert die Sperre automatisch und testet
sofort erneut — ein Klick genügt.

**Weg B — in den Einstellungen:**
**Einstellungen → Home Assistant → „Nur lokale HA-URL erlauben“** ausschalten,
**Speichern**, dann **„Verbindung testen“**. Auch hier erlaubt der Verbindungstest
eine öffentliche Adresse automatisch, sobald sie erreichbar ist.

**Weg C — ohne API-Zugriff (HA-Integration):**
Kann PVM HA **gar nicht** direkt erreichen (Firewall, HA nur intern erreichbar,
Zertifikatsfehler), brauchst du die Sperre nicht zu umgehen. Richte PVM in Home
Assistant als **Integration** ein (siehe [hacs.md](hacs.md)); die Integration
sendet HA-Zustände selbst an PVM. Im Setup-Assistenten klickst du dann auf
**„Ohne API verbinden (HA-Integration)“** — ein HA-Token ist in PVM nicht nötig.

**Weg D — Sicherheitsempfehlung:**
Wenn möglich, nutze für die Server-zu-Server-Verbindung die **lokale** HA-URL
(IP:8123) und behalte die Sperre aktiv. Öffentliche Adressen nur dann
erlauben, wenn PVM und HA nicht im selben Netz stehen.

---

## Teil 4 — „PVM-Backend ist nicht erreichbar“ (PVM-002) beheben

Diese Meldung erscheint direkt im Browser. Arbeite die Punkte der Reihe nach ab:

1. **Läuft der PVM-Server?**
   ```bash
   docker ps                      # Container "pvm" muss "Up" sein
   # oder:
   sudo systemctl status pvm
   ```
2. **Antwortet die API lokal?**
   ```bash
   curl http://localhost:7000/api/health
   ```
   Keine Antwort → Logs prüfen: `docker compose logs -f pvm` bzw.
   `journalctl -u pvm -f`.
3. **Richtige Adresse im Browser?** Läuft PVM auf einem anderen Rechner, nutze
   dessen IP (`http://192.168.1.20:7000`) statt `localhost`.
4. **Firewall/Port?** Port `7000` muss offen sein (`PVM_PORT`). In der
   `docker-compose.yml` ist `7000:7000` bereits gemappt.
5. **Reverse-Proxy?** Läuft PVM hinter nginx/Caddy, muss das UI mit der
   öffentlichen API-Basis gebaut werden:
   ```bash
   VITE_PVM_API_BASE=https://pvm.example.tld/api npm run build
   ```
   Ohne das ruft die UI `/api` auf der falschen Domain auf.
6. **Falscher Token?** Kommt statt der Verbindungsmeldung „PVM-004“, stimmt das
   eingegebene `PVM_API_SECRET` nicht.

Der Fehlerbildschirm zeigt unten die **verwendete API-Basis** an — damit siehst
du sofort, welche Adresse der Browser erwartet.

---

## Teil 5 — Kompletter Ablauf in Kurzform

1. **Backend starten:** `docker compose up -d --build` (Option A) oder
   `npm install && npm run build && npm start` (Option B).
2. **Prüfen:** `curl http://localhost:7000/api/health` → `{"status":"ok",…}`.
3. **UI öffnen:** `http://<PVM-Host>:7000`.
4. **HA-Integration installieren** (HACS oder manuell) und mit der PVM-URL +
   `PVM_API_SECRET` verbinden — siehe [hacs.md](hacs.md).
5. **Im PVM-Setup-Assistenten** den **Long-Lived Access Token** einfügen
   (HA → Profil → Sicherheit → Long-Lived Access Tokens).
6. **PVM-016?** Einmalig „Nicht-lokale HA-Adresse erlauben“ klicken.
7. **Fertig:** Geräte werden erkannt, Store und Steuerung freigeschaltet.

## Verwandte Dokumente

- [installation.md](installation.md) — Installationsmodi, Umgebungsvariablen, Backups
- [hacs.md](hacs.md) — HACS-Installation und Fehlersuche
- [home-assistant.md](home-assistant.md) — HA-Integration, Services, Discovery
- [error-codes.md](error-codes.md) — alle Fehlercodes mit Lösungshinweis
