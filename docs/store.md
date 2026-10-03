# PVM Store (addon system)

The **PVM Store** is PVM's own addon system. It is deliberately _not_ the Home
Assistant addon store and never installs HA add-ons.

## Lifecycle

```
GitHub URL / store id
      │
      ▼
1. Fetch manifest     (pvm-addon.json | pvm.json | manifest.json)
2. Validate manifest  (schema, dependencies, version range)  → PVM-011 on failure
3. Security scan      (content, scripts, permissions)        → PVM-012 if critical
4. Download & verify  (size limits, integrity hash if present)
5. Configure          (configSchema → user values)
6. Activate           (summary of granted permissions)
7. On error           (warn, disable/quarantine, log)         → PVM-013
```

## Security model

- Only `github.com` sources are accepted (public content, never executed on
  fetch).
- Fetches are bounded: ≤ 200 files, ≤ 5 MB total, 20 s timeout.
- Every file is scanned for dangerous patterns (eval, child_process, network
  exfiltration, obfuscation). Findings carry a severity.
- Requested permissions are intersected with allowed permissions; only the
  intersection is granted.
- Security mode (`strict` / `moderate` / `lenient`) governs how aggressive the
  scanner and the blocking behaviour are. `strict` blocks on `high`.
- Community addons are listed separately and are not recommended by default.
- A failing scan quarantines the addon and emits **PVM-012**.

## Permissions

`devices:read`, `devices:write`, `forecast:read`, `calendar:read`,
`calendar:write`, `store:read`, `settings:read`, `network:outbound`,
`storage:local`, `log:write`.

## API

See [api.md](api.md) → _PVM Store_. Highlights:

- `GET /api/addons/store` — browse the built-in registry
- `POST /api/addons/install` — install from a GitHub URL or store id
- `POST /api/addons/:id/update` — update to the latest compatible version
- `POST /api/addons/:id/enable|disable`, `DELETE /api/addons/:id`

## Store UI

The **Store** page mirrors the familiar addon-store layout:

- **Installiert** (installed) and **Verfügbar** (available) sections
- filters by category, status and priority (essential / standard / optional)
- search, version/author, detail view with config fields and logs
- "Add GitHub URL" to install a custom addon
- a "Mehr" (more) disclosure keeps only the important addons visible by default
- **Community** addons shown in their own category
