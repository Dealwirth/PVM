# Home Assistant integration

PVM talks to Home Assistant over the **HA Local API**:

- REST (`/api/states`, `/api/services/*`, `/api/history/period/*`)
- WebSocket (`/api/websocket`) for real-time state changes **and** the registries
  (`config/device_registry/list`, `config/entity_registry/list`)

Authentication uses a **Long-Lived Access Token** created in HA under
_Profile → Security → Long-Lived Access Tokens_.

## Setup assistant (only the token is required)

The PVM web UI shows a setup assistant on first run. The HA URL is detected
automatically, so the user only pastes the Long-Lived Access Token:

1. The HA custom component pushes this HA instance's base URL(s)
   (`internal_url`, `external_url`, API base URL) to
   `POST /api/ha/internal/detect` on setup.
2. The user pastes the token; PVM verifies it with a real `GET /api/config`
   call (`POST /api/settings/test-ha`) and only saves it after success.
3. The token is stored server-side (masked in the UI) and never returned to
   the browser.

If detection fails (e.g. HA has no internal/external URL configured), the
assistant offers an "Advanced" field to enter the HA URL manually. Calling the
`pvm.detect_ha_url` service re-runs detection after changing the HA URL.

## Connection & security

- The token is stored server-side in SQLite and never returned to the browser.
- `HA_LOCAL_ONLY=true` rejects URLs that are not loopback / RFC1918 (`PVM-016`).
- TLS verification can be toggled per integration (don't disable in production).
- Connection failures surface as `PVM-002` (unreachable) or `PVM-003`
  (authentication rejected), both with remediation hints.

## Data flow

```
HA device registry ─┐
HA entity registry ─┼─► discovery ─► suggested device type + sensor mask
HA states          ─┘        │
                             ▼
                     PVM device (adopt / manual)
                             │
              controls ◄─────┴─────► state sync (WS + polling)
```

### Discovery

`GET /api/discovery` reads the device + entity registries and the
current states, groups entities by `device_id`, and suggests:

- a **device type** (`pv`, `battery`, `wallbox`, `heat_pump`, `heater`,
  `load`, `generic`) from `device_class`, domain and entity names,
- a **sensor mask** (`power_only`, `temperature_only`, `dual`, `energy_only`,
  `state_only`, `advanced`) from the available entities,
- the **controllable capabilities** from the entities' domains.

Already-adopted devices are excluded. `POST /api/discovery/adopt` persists a
suggestion as a real PVM device; manual devices can be added with
`POST /api/devices` (optionally by entity id).

### State synchronisation

- The HA WebSocket client keeps values fresh and reconnects with backoff.
- `POST /api/devices/:id/refresh` forces a REST refresh of one device.
- `GET /api/ha/history/:entityId?start=&end=` proxies HA history.

## Control

Device commands map onto HA services:

| PVM capability                   | HA call                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `state`                          | `switch.turn_on` / `switch.turn_off` (or `light`, `input_boolean`) |
| `temperature` / `setpoint`       | `climate.set_temperature` or `number.set_value`                    |
| `power` / `charge` / `discharge` | `number.set_value` or `switch.turn_on/off`                         |

## `pvm.*` services (exposed to HA)

The custom component registers these services so HA automations can drive PVM:

`pvm.set_device_state`, `pvm.set_device_power`,
`pvm.set_device_temperature`, `pvm.update_plan`, `pvm.get_forecast`,
`pvm.get_calendar_events`, `pvm.get_history`, `pvm.get_sensors`,
`pvm.get_entities`, `pvm.get_devices`, `pvm.run_planning_cycle`,
`pvm.detect_ha_url`.

They are forwarded to the PVM backend at
`POST /api/ha/services/:service`, which validates the payload with a per-service
schema (`packages/shared/src/schemas/ha-service.ts`) before dispatching.

The component ships UI metadata for every service in `services.yaml` plus
`strings.json` (English) and `translations/{de,en}.json`.

## Installing the custom component

1. Copy `custom_components/pvm` to `<HA config>/custom_components/pvm`.
2. Restart Home Assistant.
3. **Settings → Devices & Services → Add Integration → PVM**.
4. Enter the PVM backend URL (e.g. `http://localhost:7000`) and the PVM API
   token, then submit.

The component then adds a **PVM** entry to the sidebar and a device
"PVM (PV-Manager)" with diagnostic sensors (total power, device count,
residual energy, production energy).

### Same-origin proxy

The panel embeds the PVM UI in an iframe. API calls from the UI go to
`/api/pvm/<path>` inside HA, which the component forwards to the PVM backend
with the stored token. This avoids CORS and keeps the token out of the browser.
