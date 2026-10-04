# Testing & acceptance (section 14)

## Test layers

| Layer             | Tool                       | Location                                                                  |
| ----------------- | -------------------------- | ------------------------------------------------------------------------- |
| Unit              | Vitest                     | `apps/server/src/__tests__/*.test.ts`, `apps/web/src/__tests__/*.test.ts` |
| Integration (API) | Vitest + `app.inject`      | `apps/server/src/__tests__/api.integration.test.ts`                       |
| End-to-end        | Cypress                    | `apps/web/cypress/e2e/pvm-flow.cy.ts`                                     |
| Lint / format     | ESLint + Prettier          | repo-wide                                                                 |
| Types             | `tsc -b` (no `any`)        | repo-wide                                                                 |
| Security          | `npm audit`, addon scanner | CI                                                                        |

## Commands

```bash
npm run typecheck     # tsc -b across workspaces
npm run lint          # eslint
npm run format:check  # prettier --check
npm test              # server + web unit/integration
npm run test:e2e      # Cypress (needs the stack running)
```

### Running the E2E suite

```bash
# Terminal 1 — backend
PVM_API_SECRET=e2e-secret npm start

# Terminal 2 — web dev server
PVM_API_SECRET=e2e-secret npm run dev -w @pvm/web

# Terminal 3
PVM_E2E_BASE_URL=http://localhost:7001 npx cypress run \
  --project apps/web
```

## Acceptance scenario → coverage

| Step (section 14)                        | Covered by                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Installation / setup                     | README quick start, `Dockerfile`, `docker-compose.yml`, CI `docker` job                    |
| HA connection, data, errors              | `docs/home-assistant.md`, `ha/` component, `PVM-002/003/016`, `api.integration` auth tests |
| Device detection (auto/manual)           | `ha/discovery.ts`, `GET /api/discovery`, `POST /api/devices`, Cypress "lists devices"      |
| Prioritisation                           | `devices.priority`, `DeviceFilter`, planner tests                                          |
| Forecast (correct/changeable)            | `forecast.test.ts`, `POST /api/forecast/generate`, Cypress forecast page                   |
| Plan-loading algorithm                   | `planner.test.ts`, `POST /api/plan/generate`, determinism test                             |
| Addon store (install/update/remove)      | `addon-security.test.ts`, `addonRoutes`, Cypress store page                                |
| Security (protection/shutdown/self-heal) | `docs/safety.md`, `safetyRoutes`, `safety.ts`                                              |
| Dev-log (levels, export/import)          | `devlog.ts`, `/api/logs*`, integration "stats/export" tests                                |
| UI (responsive, DE/EN)                   | Tailwind breakpoints, `i18n.test.ts`, Cypress language switch                              |
| Finalisation (section 14)                | this file + `README.md`                                                                    |

## Determinism

The planner is deterministic: identical inputs produce byte-identical plans
(verified in `planner.test.ts`). Forecast weighting is configurable but stable
for a fixed dataset.
