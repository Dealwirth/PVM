# Changelog

All notable changes to PVM are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[Semantic Versioning](https://semver.org/).

## [1.4.0] — 2026-10-03

### Added

- **API-free connection mode.** PVM no longer requires direct network access to
  Home Assistant. The HA integration now pushes a snapshot of its data (states,
  services, device/entity/area registries) to PVM via
  `POST /api/ha/internal/ingest` on every poll cycle, and PVM's HA reads fall
  back to that snapshot when it cannot reach HA directly (firewall, HA bound to
  a private address, self-signed certificate). The setup assistant gains a
  **"Connect without API (HA integration)"** button and `POST
/api/settings/test-ha` accepts `requireIntegration`. No HA token is required
  in PVM in this mode.
- New error code `PVM-022` (HA integration not connected).

### Changed

- **A public HA URL is never a dead end.** When the local-only guard blocks a
  DuckDNS/Nabu Casa URL (`PVM-016`), the setup assistant and settings test now
  verify it and allow it in one step (the result carries `publicUrl: true`), then
  remember the choice. `POST /api/settings/test-ha` accepts `allowRemote`.
- The HA component's URL auto-detection (`/api/ha/internal/detect`) verifies
  public candidates instead of blocking them, since the component only forwards
  HA's own URLs and is authenticated with the PVM token.

## [1.3.0] — 2026-10-03

### Added

- **Backup & restore** (`apps/server/src/services/backup.ts`): full JSON backup
  of settings, devices, history, forecasts, load plans, calendar and addon
  configuration, restorable in a single transaction. Exposed as
  `GET /api/backup/info`, `GET /api/backup/export` and `POST /api/backup/import`,
  with a new **Backup & Wiederherstellung** card in the settings UI. The HA
  token is excluded unless you explicitly opt in.
- New error code `PVM-021` (invalid backup).
- Beginner-friendly documentation of setting effects: [docs/effects.md](docs/effects.md).

### Changed

- **Setup assistant** now supports every common way of reaching Home Assistant
  (Automatic, local network, DuckDNS, Nabu Casa, Docker host, manual URL),
  always shows the URL field, and explains the impact of the token and of local
  vs. public addresses in an expandable section. Choosing DuckDNS/Nabu Casa
  lifts the local-only guard automatically.
- General-settings toggles (auto-start, shutdown on error, self-healing, safety
  mode, backup/export, developer mode) now show a short explanation of their
  effect.

## [1.2.0] — 2026-10-02

### Added

- Secure HA token setup: the user only enters the Long-Lived Access Token, the
  HA URL is detected automatically (`detect_ha_url`).
- HACS-installable Home Assistant integration (`custom_components/pvm`).

### Fixed

- PVM↔HA connection now works with DuckDNS / non-local HA URLs; the local-only
  guard can be lifted and returns a precise `PVM-016` instead of a masked
  `PVM-002`.

## [1.1.0]

### Added

- Standalone PVM backend (Fastify + SQLite), React web UI, device management,
  forecast/planner, PVM Store and dev-log.
