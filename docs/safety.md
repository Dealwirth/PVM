# Safety, shutdown & self-healing

The safety subsystem (`apps/server/src/services/safety.ts`) is designed to
catch nearly every fault and, where configured, react automatically.

## Triggers

| Trigger                                 | Reaction                                      | Error code        |
| --------------------------------------- | --------------------------------------------- | ----------------- |
| Grid import > `safety.maxGridImportW`   | Shed lowest-priority loads until within limit | PVM-007           |
| Device power > `safety.maxDevicePowerW` | Switch the device off                         | PVM-007           |
| Temperature > `safety.maxTemperatureC`  | Switch the device off                         | PVM-008           |
| Any error with `triggersShutdown: true` | Record shutdown, emit event                   | PVM-014           |
| HA unreachable / token rejected         | Mark connection fault, warn                   | PVM-002 / PVM-003 |
| Non-local HA URL                        | Block connection                              | PVM-016           |
| Addon fails security scan               | Disable/remove addon                          | PVM-012           |

`autoShutdown` (Settings → Safety) gates all automatic reactions. When off,
faults are only logged and surfaced in the UI.

## Load shedding

```
excess = totalPowerW − maxGridImportW
candidates = active devices with allowAutoShutdown + controllable power,
             sorted by priority asc, then name
turn off candidates until shed ≥ excess
```

## Self-healing

- When a device is switched off by safety, the last good state is captured
  (`captureGoodState`).
- `POST /api/safety/self-heal` restores suspended devices from that snapshot.
- Successful restores are recorded as **PVM-018** (`self_healed`); failures as
  `self_heal_failed`, which also notifies the user (see Notifications).

## Audit trail

Every reaction is persisted to the `safety_events` table and streamed to the UI
over WebSocket. Read it with `GET /api/safety/events`.

`POST /api/safety/evaluate` lets HA automations push a live power reading so
load shedding can run outside the PVM polling loop.
