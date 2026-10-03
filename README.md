# PVM — PV-Manager

PVM is a standalone web application for photovoltaic / energy management that
runs alongside **Home Assistant (HA)**. It reads and controls HA devices through
the HA Local API (REST + WebSocket) using a Long-Lived Access Token, adds
prioritised load management, forecasting, a deterministic load-planning
algorithm, a hardened addon store, a structured developer log and a
self-healing safety system — all in a responsive, bilingual (DE/EN) UI.

PVM is _not_ a HA addon and does _not_ use the HA addon store. It has its own
**PVM Store** for addons.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  Standalone UI (React + Vite + Tailwind)      │
│  Dashboard, Devices, Calendar, Forecast,      │
│  Store, Dev-Log, Safety, Settings, Tutorial   │
└───────────────────────┬──────────────────────┘
                        │ REST + WebSocket
┌───────────────────────▼──────────────────────┐
│  PVM API (Node.js + TypeScript + Fastify)     │
│  Auth, Devices, Priority, Load management,    │
│  Forecast, Calendar, Planner, PVM Store,      │
│  Safety, Dev-Log                              │
└───────────────────────┬──────────────────────┘
                        │ HA Local API (REST/WS)
┌───────────────────────▼──────────────────────┐
│  Home Assistant                               │
│  Custom panel (panel_custom), pvm.* services, │
│  device/entity registry, states, history      │
└──────────────────────────────────────────────┘
```

### Repository layout

| Path                    | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `packages/shared`       | Domain types, zod schemas, error catalogue, utils (shared by server & web) |
| `apps/server`           | Fastify API, HA client, SQLite persistence, all business services, tests   |
| `apps/web`              | React SPA (Vite, Tailwind, React Query, Zustand, i18next), Cypress E2E     |
| `custom_components/pvm` | Home Assistant custom component: panel, services, proxy, sensors           |
| `docs`                  | User & operator documentation                                              |
| `.github/workflows`     | CI (typecheck, lint, build, tests, dependency audit, Docker build)         |

---

## Quick start

### Prerequisites

- Node.js ≥ 20 (developed on Node 24)
- npm ≥ 10
- A running Home Assistant instance with a **Long-Lived Access Token**
  (HA → Profile → Security → Long-Lived Access Tokens)

### 1. Install & configure

```bash
cp .env.example .env
# Edit .env:
#   PVM_API_SECRET  -> a long random string (>= 32 chars)
#   HA_URL          -> e.g. http://homeassistant.local:8123
#   HA_TOKEN        -> your Long-Lived Access Token
npm install
```

### 2. Develop

```bash
npm run dev          # server on :7000, web on :7001 (proxying /api and /ws)
```

Open <http://localhost:7001>.

### 3. Build & run (production)

```bash
npm run build
npm start            # serves API + built UI on http://localhost:7000
```

### 4. Docker

```bash
export PVM_API_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

The container serves API + UI on port `7000` and persists data in the
`pvm-data` volume. Add `--profile dev` for a hot-reload web server.

---

## Required settings (mandatory)

The PVM Store and device control stay locked until these required settings are
present. The UI shows a `PVM-001` banner listing exactly what is missing.

- **Home Assistant**: HA host URL **and** Long-Lived Access Token.
- **PVM API**: `PVM_API_SECRET` (server-side) and the language/timezone.
- **Safety**: limits (`maxGridImportW`, `maxDevicePowerW`, `minBatteryPercent`)
  and the security mode (`strict` / `moderate` / `lenient`).
- **Log**: log level (`DEBUG`…`FATAL`).

See `docs/settings.md` for the complete list.

---

## Home Assistant integration

Copy `custom_components/pvm` into your HA `config/custom_components/pvm`
directory and restart HA. Add the integration via **Settings → Devices &
Services → Add Integration → PVM**, entering the PVM backend URL and token.

The component:

- registers a sidebar panel that embeds the PVM UI,
- proxies `/api/pvm/*` through HA (token never leaves the server),
- exposes `pvm.*` services and a few diagnostic sensors.

Details: `docs/home-assistant.md`.

---

## Testing

```bash
npm test              # server unit/integration + web unit
npm run test:server   # vitest (server)
npm run test:web      # vitest (web)
npm run test:e2e      # Cypress (needs a running stack)
```

`docs/testing.md` maps every test to the acceptance scenario in the
specification (section 14).

---

## Error codes

Every failure has a stable code, category, severity and remediation hint
(`packages/shared/src/errors/catalog.ts`). The API always returns:

```json
{
  "error": {
    "code": "PVM-002",
    "category": "network",
    "severity": "high",
    "message": "…",
    "remediation": "…"
  }
}
```

See `docs/error-codes.md`.

---

## Documentation

| Document                                             | Contents                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| [docs/installation.md](docs/installation.md)         | Install modes (standalone, Docker, HACS), env, proxy, backups |
| [docs/home-assistant.md](docs/home-assistant.md)     | HA integration, services, discovery, error handling           |
| [docs/settings.md](docs/settings.md)                 | All settings incl. the mandatory ones                         |
| [docs/forecast-planner.md](docs/forecast-planner.md) | Forecast methods and the load-planning algorithm              |
| [docs/store.md](docs/store.md)                       | PVM Store architecture, security pipeline, permissions        |
| [docs/safety.md](docs/safety.md)                     | Shutdown rules, load shedding, self-healing                   |
| [docs/api.md](docs/api.md)                           | Complete REST + WebSocket reference                           |
| [docs/error-codes.md](docs/error-codes.md)           | Error catalogue and API envelope                              |
| [docs/testing.md](docs/testing.md)                   | Test layers and section 14 acceptance mapping                 |

---

## License

MIT.
