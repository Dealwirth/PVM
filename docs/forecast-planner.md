# Forecast & load planning

## Forecast

`apps/server/src/services/forecast.ts` produces a residual-energy forecast from
four inputs:

1. **Historical data** — daily/weekly/total device energy (`history` table).
2. **Weather** — irradiance and temperature from an HA weather entity.
3. **Calendar** — holidays, work patterns, recurring trips.
4. **Settings** — comfort/priority preferences.

Methods (selectable, `forecast.methods`):

| Method               | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `time_series`        | Linear regression over weighted history (recent data weighted higher) |
| `weather_regression` | Regression of yield on irradiance/temperature                         |
| `combined`           | Weighted blend (`combinedWeatherWeight`)                              |

Outputs: residual energy per day/week/total and a recommended charge plan.
Regenerate with `POST /api/forecast/generate`; read with
`GET /api/forecast/latest`.

## Load-planning algorithm

Deterministic given the same inputs (`POST /api/plan/generate`).

**Inputs**

- residual-energy forecast
- device priorities (0–100)
- battery level
- weather
- calendar
- user settings

**Outputs**

- recommended load plan: `{ start, end, powerW, deviceId, priority }[]`
- applicable conditions (battery, comfort, price, weather, calendar)

**Constraints honoured**

- devices are scheduled by descending priority
- battery stays above `safety.minBatteryPercent`
- total plan power never exceeds forecast surplus (plus grid allowance)
- comfort windows from the calendar are preferred

Because ordering is stable and floating-point work is fixed, identical inputs
yield identical plans. See `planner.test.ts`.

## Calendar

HA calendars are synced via `calendar.sources` (entity ids + refresh interval).
Events are typed as holidays, work or recurring trips and fed into both the
forecast and the planner.
