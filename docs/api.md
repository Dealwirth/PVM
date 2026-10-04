# API reference

Base URL: `http://<host>:7000/api`

All endpoints except `/health`, `/auth/login` and `/ws` require a bearer token:

```
Authorization: Bearer <token>
```

Obtain a token with `POST /auth/login` (body `{ "token": "<PVM_API_SECRET>" }`).
Errors follow the shape `{ "error": { "code", "category", "severity",
"message", "remediation" } }` — see [error-codes.md](error-codes.md).

## Health & auth

| Method | Path          | Description                                  |
| ------ | ------------- | -------------------------------------------- |
| GET    | `/health`     | Liveness + HA status + uptime                |
| POST   | `/auth/login` | Exchange `PVM_API_SECRET` for a bearer token |

## Devices

| Method | Path                   | Description                                                         |
| ------ | ---------------------- | ------------------------------------------------------------------- |
| GET    | `/devices`             | List (filter: `type`, `priority`, `status`, `sensorMask`, `search`) |
| POST   | `/devices`             | Create manually                                                     |
| GET    | `/devices/:id`         | Detail                                                              |
| PUT    | `/devices/:id`         | Update                                                              |
| DELETE | `/devices/:id`         | Remove                                                              |
| GET    | `/devices/:id/history` | History (`since`, `until`)                                          |
| POST   | `/devices/:id/refresh` | Refresh entity values from HA                                       |
| POST   | `/devices/:id/command` | Execute a command (`capability`, `value`)                           |
| GET    | `/discovery`           | Discover HA devices                                                 |
| POST   | `/discovery/adopt`     | Adopt a discovered device                                           |

## Settings

| Method | Path                 | Description                                     |
| ------ | -------------------- | ----------------------------------------------- |
| GET    | `/settings`          | Full settings                                   |
| GET    | `/settings/required` | Missing mandatory settings                      |
| PUT    | `/settings`          | Patch settings                                  |
| POST   | `/settings/test-ha`  | Test the HA connection (optional `{url,token}`) |

## Dashboard & planning

| Method | Path                   | Description                        |
| ------ | ---------------------- | ---------------------------------- |
| GET    | `/dashboard`           | Aggregated dashboard               |
| POST   | `/dashboard/run-cycle` | Run forecast + plan + safety cycle |
| GET    | `/forecast/latest`     | Latest forecast (`horizon`)        |
| GET    | `/forecast/history`    | Stored forecasts                   |
| POST   | `/forecast/generate`   | Recompute a forecast               |
| GET    | `/plan/latest`         | Latest load plan                   |
| GET    | `/plan/history`        | Stored plans                       |
| POST   | `/plan/generate`       | Recompute a plan                   |
| POST   | `/plan/settings`       | Update planner settings            |

## Calendar

| Method | Path                    | Description              |
| ------ | ----------------------- | ------------------------ |
| GET    | `/calendar/sources`     | List HA calendar sources |
| POST   | `/calendar/sources`     | Add a source             |
| DELETE | `/calendar/sources/:id` | Remove a source          |
| POST   | `/calendar/sync`        | Sync now                 |
| GET    | `/calendar/events`      | Events (`start`, `end`)  |

## Dev-Log

| Method | Path                            | Description                                                               |
| ------ | ------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/logs`                         | Query (level, minLevel, category, since, until, search, errorCode, limit) |
| GET    | `/logs/export?format=json\|csv` | Download                                                                  |
| GET    | `/logs/stats`                   | Counts per level                                                          |
| DELETE | `/logs`                         | Clear in-memory buffer                                                    |

## PVM Store (addons)

| Method | Path                             | Description                               |
| ------ | -------------------------------- | ----------------------------------------- |
| GET    | `/addons`                        | Installed addons                          |
| GET    | `/addons/store`                  | Available addons (built-in registry)      |
| GET    | `/addons/:id`                    | Detail                                    |
| GET    | `/addons/:id/logs`               | Addon log                                 |
| POST   | `/addons/install`                | Install (`source`, `version?`, `config?`) |
| POST   | `/addons/:id/update`             | Update                                    |
| POST   | `/addons/:id/enable` / `disable` | Toggle                                    |
| PUT    | `/addons/:id/config`             | Configure                                 |
| DELETE | `/addons/:id`                    | Remove                                    |

## Safety

| Method | Path                | Description                   |
| ------ | ------------------- | ----------------------------- |
| GET    | `/safety/events`    | Safety/shutdown log           |
| POST   | `/safety/evaluate`  | Evaluate load (`totalPowerW`) |
| POST   | `/safety/self-heal` | Restore last good state       |

## Home Assistant bridge

| Method | Path                    | Description                           |
| ------ | ----------------------- | ------------------------------------- |
| GET    | `/ha/status`            | Connection state                      |
| GET    | `/ha/config`            | HA config                             |
| GET    | `/ha/states`            | All states                            |
| GET    | `/ha/services`          | Available services                    |
| GET    | `/ha/history/:entityId` | History                               |
| POST   | `/ha/services/:service` | Invoked by the HA component (`pvm.*`) |
| POST   | `/ha/internal/detect`   | HA URL auto-detection (HA component)  |

## Errors

| Method | Path              | Description          |
| ------ | ----------------- | -------------------- |
| GET    | `/errors/catalog` | Full error catalogue |

## WebSocket

`ws://<host>:7000/ws` streams `log` entries, `device` updates and
`safety` events. Authenticate with the same bearer token.
