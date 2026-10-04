# AGENTS.md — PVM (PV-Manager)

Standalone PV/energy-management web app for Home Assistant. Monorepo:
`packages/shared` (types/schemas/errors), `apps/server` (Fastify + SQLite),
`apps/web` (React/Vite SPA), `custom_components/pvm` (HA component).

## Commands

```bash
npm run typecheck   # tsc -b, must stay clean (no any)
npm run lint        # eslint
npm run format:check / npm run format
npm run build       # shared + server (tsc) + web (vite)
npm test            # server + web vitest
npm run test:e2e    # Cypress; needs a running stack
```

## Environment quirks

- Local Node is **v24**, but `better-sqlite3` is only prebuilt for Node 20.
  Running the compiled server locally (`apps/server/dist/index.js`) crashes with
  a native assertion. Tests run fine (vitest). To run the real server, use the
  Node 20 Docker image or `npm rebuild better-sqlite3`.
- Docker needs `sudo dockerd` started first; use `sudo docker ...` (the socket
  is root-owned).
- Cypress needs `xvfb-run -a` and the apt packages installed
  (`xvfb libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2t64
libxtst6 xauth`). Run `apt-get update` first (repo snapshot).

## E2E

Run against the built container (serves UI + API on :7000):

```bash
cd apps/web
PVM_E2E_BASE_URL=http://localhost:7000 PVM_API_SECRET=e2e-secret \
  xvfb-run -a npx cypress run --browser electron
```

## Conventions

- HA WebSocket registry commands take a `config/` prefix
  (`config/device_registry/list`, ...). `HaClient.getRegistry` tries the
  prefixed name first and falls back to the legacy unprefixed name, so device
  discovery works across HA versions. Do not assume the unprefixed form.
- `/api/forecast/generate` is validated with `forecastInputSchema`
  (`packages/shared/src/schemas/forecast.ts`); add new request bodies to a schema
  rather than casting `request.body`.
- The HA bridge (`POST /api/ha/services/:service`) validates payloads with
  `HA_SERVICE_SCHEMAS` (`packages/shared/src/schemas/ha-service.ts`). Add a
  schema there for any new `pvm.*` service that takes input.
- The HA component forwards only keys listed in `_ALLOWED_KEYS`
  (`custom_components/pvm/__init__.py`) — update it and `SERVICE_SCHEMA` in
  `const.py`, `services.yaml`, plus `strings.json`/`translations` together.
- HA registry WS commands need the `config/` prefix; `HaClient.getRegistry`
  falls back to the legacy name for old HA versions.
- The HA component declares `frontend`/`panel_custom`, so `tests/ha/requirements.txt`
  must include `home-assistant-frontend` (pinned to HA's required version) or
  `pytest tests/ha` fails to set up the integration.
- Static SPA assets are public; only `/api` and `/ws` require the bearer token.
- Docker runtime stage installs prod deps via `npm ci` (nested workspace modules
  like `apps/server/node_modules/@fastify/static` must exist for ESM resolution).
- Error codes live in `packages/shared/src/errors/catalog.ts`; document new ones
  in `docs/error-codes.md`.
- Docs live in `docs/`; keep the README documentation table in sync.
- The PVM store install endpoint (`POST /api/addons/install`) accepts either a
  GitHub repo URL (fetched via the REST API) or a bare store manifest id
  (e.g. `pvm.sensor.pv`), which resolves against `BUILTIN_STORE` /
  `listStore()` in `apps/server/src/services/addon-fetcher.ts`.
- Runtime requires Node 22 for `better-sqlite3`; Node 24 breaks its native ABI.
  Run the server/tests with `npx -y node@22` if the default Node is 24.
- HACS packaging: keep `custom_components/pvm/manifest.json` to HA's standard
  keys only (no `homeassistant` key — that belongs in `hacs.json`). `hacs.json`
  and `manifest.json` versions are bumped independently when releasing.
- CI validations: `.github/workflows/hacs.yml` (HACS Action, category
  `integration`) and `.github/workflows/hassfest.yml` must stay green; a HACS
  release requires a full GitHub release (not just a tag). The HACS Action also
  checks repo metadata — a repository **description** and at least one
  **topic** (e.g. `home-assistant`, `hacs`) must be set in the GitHub repo
  settings; the license check reads `LICENSE` from the default branch, so merge
  before expecting it to pass.
