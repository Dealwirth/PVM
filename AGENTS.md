# AGENTS.md — PVM (PV-Manager)

Standalone PV/energy-management web app for Home Assistant. Monorepo:
`packages/shared` (types/schemas/errors), `apps/server` (Fastify + SQLite),
`apps/web` (React/Vite SPA), `ha/custom_components/pvm` (HA component).

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

- Static SPA assets are public; only `/api` and `/ws` require the bearer token.
- Docker runtime stage installs prod deps via `npm ci` (nested workspace modules
  like `apps/server/node_modules/@fastify/static` must exist for ESM resolution).
- Error codes live in `packages/shared/src/errors/catalog.ts`; document new ones
  in `docs/error-codes.md`.
- Docs live in `docs/`; keep the README documentation table in sync.
