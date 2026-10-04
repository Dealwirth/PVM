# Settings reference

All settings live in the SQLite database and are editable in
**Settings** in the web UI (or via `PUT /api/settings`). Every write bumps
`revision`. `GET /api/settings/required` reports which mandatory settings are
still missing.

## Mandatory settings (gate the store & device control)

`GET /api/settings/required` returns `complete: false` and a list of missing
items until all of the following are set. Until then the API returns `PVM-001`
for store installs and device control.

| Key                        | Meaning                                       |
| -------------------------- | --------------------------------------------- |
| `ha.url`                   | Home Assistant base URL                       |
| `ha.token`                 | Long-Lived Access Token                       |
| `general.language`         | `de` or `en`                                  |
| `general.timezone`         | IANA timezone or `auto`                       |
| `safety.maxGridImportW`    | Grid import limit before load shedding        |
| `safety.maxDevicePowerW`   | Per-device power limit before shutdown        |
| `safety.minBatteryPercent` | Battery reserve floor                         |
| `safety.mode`              | `strict` / `moderate` / `lenient`             |
| `log.level`                | `DEBUG` / `INFO` / `WARN` / `ERROR` / `FATAL` |

## General

| Key                  | Default | Notes                              |
| -------------------- | ------- | ---------------------------------- |
| `language`           | `de`    | UI language                        |
| `timezone`           | `auto`  | Used for calendar & plan rendering |
| `units.power`        | `W`     | `W` or `kW`                        |
| `units.temperature`  | `C`     | `C` or `F`                         |
| `units.energy`       | `kWh`   | `Wh` or `kWh`                      |
| `autoCache`          | `true`  | Cache HA states                    |
| `autoUpdate`         | `false` | Auto-update installed addons       |
| `autoStartOnHaStart` | `false` | Start stream/scheduler with HA     |
| `shutdownOnError`    | `true`  | Safety shutdown on critical errors |
| `selfHealing`        | `true`  | Restore last good state            |
| `safetyMode`         | `true`  | Enable the safety subsystem        |
| `backupExport`       | `false` | Enable backup/export endpoints     |
| `developerMode`      | `false` | Expose extra dev tooling           |

## Home Assistant (`ha`)

| Key               | Notes                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| `url`             | e.g. `http://homeassistant.local:8123`                                |
| `token`           | Long-Lived Access Token (stored hybrid-encrypted, never returned raw) |
| `candidateUrls`   | Alternate HA URLs probed during auto-detection                        |
| `localOnly`       | When true, non-local URLs are rejected (`PVM-016`)                    |
| `reconnectBaseMs` | WebSocket reconnect backoff base                                      |

The UI only ever receives a masked token (`••••••••`) plus a `tokenSet`
boolean; sending the mask back is ignored and never overwrites the stored
token.

## PVM API (`api`)

| Key            | Notes                                     |
| -------------- | ----------------------------------------- |
| `host`, `port` | Bind address                              |
| `corsOrigins`  | Allowed origins; empty = same-origin only |

The API secret itself is configured server-side via `PVM_API_SECRET`.

## Notifications (`notifications`)

- `email.enabled`, `email.address`, `email.smtpUrl`
- `push.enabled`, `push.webhookUrl`

## Log (`log`)

| Key                   | Notes                               |
| --------------------- | ----------------------------------- |
| `enabled`             | Master switch                       |
| `level`               | Minimum level recorded              |
| `autoLogs`            | Emit periodic diagnostic entries    |
| `maxFileSizeMb`       | Rotation threshold (default 100 MB) |
| `errorAlertThreshold` | ERROR count in window before alert  |

## Forecast (`forecast`)

| Key                     | Notes                                           |
| ----------------------- | ----------------------------------------------- |
| `enabled`               | Enable the module                               |
| `methods`               | `time_series`, `weather_regression`, `combined` |
| `recencyWeight`         | 0…1, higher = newer data weighted more          |
| `historyDays`           | History window                                  |
| `combinedWeatherWeight` | Weather share in the combined method            |
| `weatherEntityId`       | HA weather entity for irradiance/temperature    |

## Calendar (`calendar`)

| Key              | Notes                |
| ---------------- | -------------------- |
| `enabled`        | Enable sync          |
| `entityIds`      | HA calendar entities |
| `refreshMinutes` | Sync interval        |

## Safety (`safety`)

| Key                 | Notes                              |
| ------------------- | ---------------------------------- |
| `mode`              | Addon/store security mode          |
| `autoShutdown`      | Disable devices on critical errors |
| `maxGridImportW`    | Load-shedding trigger              |
| `maxDevicePowerW`   | Device shutdown trigger            |
| `minBatteryPercent` | Plan adjustment trigger            |
| `maxTemperatureC`   | Temperature shutdown trigger       |
