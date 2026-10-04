# Installation & deployment

Three installation modes are supported.

## Mode A — Standalone (recommended)

Node.js API + React UI, optionally embedded in Home Assistant as a panel.

```bash
git clone <repo> pvm && cd pvm
cp .env.example .env         # set PVM_API_SECRET, HA_URL, HA_TOKEN
npm install
npm run build
npm start                    # http://localhost:7000
```

Then install the HA custom component (see [home-assistant.md](home-assistant.md))
to embed the UI in the sidebar.

## Mode B — Docker

```bash
export PVM_API_SECRET="$(openssl rand -hex 32)"
export HA_URL="http://homeassistant.local:8123"
export HA_TOKEN="<long-lived-token>"
docker compose up --build
```

Data is persisted in the `pvm-data` volume (`/app/data`). To reach a Home
Assistant running on the Docker host, `host.docker.internal` is pre-mapped.

For hot-reload development:

```bash
docker compose --profile dev up
```

## Mode C — HACS custom component

PVM is a HACS-installable integration. Add `https://github.com/Dealwirth/PVM`
as a **custom repository** (category **Integration**) in HACS, install **PVM
(PV-Manager)**, restart Home Assistant, then add the integration via **Settings →
Devices & Services → Add Integration → PVM** with the URL and token of a running
PVM backend. HACS deploys the files under `custom_components/pvm`.

Step-by-step instructions, update/removal and troubleshooting:
[hacs.md](hacs.md).

## Mode D — Backend-Adresse, DuckDNS & Fehlersuche

Wenn die Verbindung nicht klappt („Backend nicht erreichbar“, PVM-016 bei
DuckDNS/Nabu Casa, PVM-002/003 bei HA), führt
[connect-backend.md](connect-backend.md) jeden Schritt durch — inklusive, wie
man die HA-URL findet und das Schema weglassen darf.

## Environment variables

See [.env.example](.env.example). The critical ones:

| Variable             | Purpose                       |
| -------------------- | ----------------------------- |
| `PVM_API_SECRET`     | Signs API tokens (≥ 32 chars) |
| `PVM_PORT`           | API/UI port (default 7000)    |
| `PVM_DB_PATH`        | SQLite file                   |
| `HA_URL`, `HA_TOKEN` | Home Assistant connection     |
| `HA_LOCAL_ONLY`      | Reject non-local HA URLs      |
| `PVM_CORS_ORIGINS`   | Extra allowed origins         |

## Reverse proxy / HTTPS

Terminate TLS with nginx or Caddy in front of PVM. Example Caddy:

```
pvm.example.tld {
    reverse_proxy localhost:7000
}
```

Keep `HA_LOCAL_ONLY=true` and use a local HA URL; expose PVM only on your LAN.

## Backups

Enable `general.backupExport`, then back up:

- the SQLite database (`PVM_DB_PATH`)
- `PVM_LOGS_DIR` (dev-log archives)
- `PVM_ADDONS_DIR` (installed addon packages)
