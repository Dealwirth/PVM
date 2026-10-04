# Error codes

Every failure carries a stable code. The catalogue lives in
`packages/shared/src/errors/catalog.ts` and is also served at
`GET /api/errors/catalog`, so the UI can always render a title, description and
a remediation hint.

| Code    | Category | Severity | Title                                    | Shutdown |
| ------- | -------- | -------- | ---------------------------------------- | -------- |
| PVM-001 | config   | critical | Pflichteinstellung fehlt                 | yes      |
| PVM-002 | network  | high     | Home Assistant nicht erreichbar          | no       |
| PVM-003 | security | critical | HA-Authentifizierung fehlgeschlagen      | yes      |
| PVM-004 | security | critical | PVM-API-Authentifizierung fehlgeschlagen | no       |
| PVM-005 | device   | medium   | Gerät nicht verfügbar                    | no       |
| PVM-006 | device   | high     | Gerätesteuerung fehlgeschlagen           | no       |
| PVM-007 | device   | critical | Leistungsgrenze überschritten            | yes      |
| PVM-008 | device   | high     | Temperaturgrenze überschritten           | yes      |
| PVM-009 | planner  | medium   | Prognose fehlgeschlagen                  | no       |
| PVM-010 | planner  | low      | Planlade-Algorithmus ohne Ergebnis       | no       |
| PVM-011 | addon    | high     | Addon-Manifest ungültig                  | no       |
| PVM-012 | addon    | critical | Addon-Sicherheitsprüfung fehlgeschlagen  | yes      |
| PVM-013 | addon    | medium   | Addon-Ausführung fehlgeschlagen          | no       |
| PVM-014 | security | critical | Sicherheits-Abschaltung ausgelöst        | yes      |
| PVM-015 | security | high     | Eingabe ungültig                         | no       |
| PVM-016 | network  | high     | Nicht-lokale HA-URL blockiert            | yes      |
| PVM-017 | planner  | medium   | Kalender-Synchronisation fehlgeschlagen  | no       |
| PVM-018 | device   | medium   | Selbstheilung durchgeführt               | no       |
| PVM-019 | security | critical | Rate-Limit überschritten                 | no       |
| PVM-020 | unknown  | medium   | Unbekannter Fehler                       | no       |
| PVM-021 | config   | medium   | Backup ungültig                          | no       |
| PVM-022 | network  | medium   | HA-Integration nicht verbunden           | no       |

## Categories

`config`, `network`, `device`, `planner`, `addon`, `security`, `unknown`.

## Severities

`low`, `medium`, `high`, `critical`. Codes with `triggersShutdown: true` are
escalated to the safety subsystem, which may disable affected devices
(see [safety.md](safety.md)).

## API envelope

```json
{
  "error": {
    "code": "PVM-006",
    "category": "device",
    "severity": "high",
    "title": "Gerätesteuerung fehlgeschlagen",
    "message": "…",
    "remediation": "Entität/Dienst prüfen, Berechtigungen des Tokens prüfen.",
    "details": { "deviceId": "…" }
  }
}
```

HTTP status mapping: `PVM-003/004 → 401`, `PVM-015 → 400`, `PVM-005/011 → 404`,
`PVM-012/016 → 403`, `PVM-019 → 429`, everything else `500`.
