import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  ha_device_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 50,
  sensor_mask TEXT NOT NULL DEFAULT 'advanced',
  capabilities TEXT NOT NULL DEFAULT '[]',
  entities TEXT NOT NULL DEFAULT '[]',
  rated_power_w REAL,
  min_power_w REAL,
  allow_auto_shutdown INTEGER NOT NULL DEFAULT 1,
  controllable INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  location TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  manually_added INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_ha ON devices(ha_device_id);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  power_w REAL,
  energy_wh REAL,
  temperature_c REAL,
  state TEXT,
  raw TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_history_device_ts ON history(device_id, timestamp);

CREATE TABLE IF NOT EXISTS production_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  production_wh REAL NOT NULL DEFAULT 0,
  consumption_wh REAL NOT NULL DEFAULT 0,
  irradiance_wm2 REAL,
  temperature_c REAL
);
CREATE INDEX IF NOT EXISTS idx_production_ts ON production_history(timestamp);

CREATE TABLE IF NOT EXISTS forecasts (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  horizon TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_forecasts_gen ON forecasts(generated_at);

CREATE TABLE IF NOT EXISTS load_plans (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plans_gen ON load_plans(generated_at);

CREATE TABLE IF NOT EXISTS calendar_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  refresh_minutes INTEGER NOT NULL DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  calendar_entity_id TEXT,
  title TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  location TEXT,
  expected_energy_wh REAL
);
CREATE INDEX IF NOT EXISTS idx_events_start ON calendar_events(start);

CREATE TABLE IF NOT EXISTS addons (
  id TEXT PRIMARY KEY,
  manifest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed',
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  granted_permissions TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  install_path TEXT NOT NULL,
  last_error TEXT,
  available_version TEXT
);

CREATE TABLE IF NOT EXISTS safety_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  action TEXT NOT NULL,
  device_id TEXT,
  message TEXT NOT NULL,
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_safety_ts ON safety_events(timestamp);
`;

export function openDatabase(path: string): Db {
  if (path !== ':memory:') {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  const db = new Database(path);
  db.exec(SCHEMA);
  return db;
}
