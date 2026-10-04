import type { BackupCounts, BackupImportResult, PvmBackup } from '@pvm/shared';
import { PvmError } from '@pvm/shared';
import type { Db } from '../db/index.js';
import type { DevLog } from './devlog.js';

const TABLES = [
  'devices',
  'history',
  'production_history',
  'forecasts',
  'load_plans',
  'calendar_sources',
  'calendar_events',
  'addons',
  'safety_events',
] as const;

type TableName = (typeof TABLES)[number];

const VERSION = '1.3.0';

function toCounts(rows: Record<TableName, unknown[]>): BackupCounts {
  return {
    devices: rows.devices.length,
    history: rows.history.length,
    productionHistory: rows.production_history.length,
    forecasts: rows.forecasts.length,
    plans: rows.load_plans.length,
    calendarSources: rows.calendar_sources.length,
    calendarEvents: rows.calendar_events.length,
    addons: rows.addons.length,
    safetyEvents: rows.safety_events.length,
  };
}

/**
 * Export and restore the PVM SQLite database as a portable JSON document.
 *
 * The export is a consistent snapshot: every table is read inside one
 * transaction. A restore validates the file, then replaces all tables inside a
 * single transaction so a bad import can never leave the database half-written.
 */
export class BackupService {
  constructor(
    private readonly db: Db,
    private readonly log: DevLog,
  ) {}

  /** Build a full backup document. Secrets are only included on request. */
  export(includesSecrets: boolean): PvmBackup {
    const read = this.db.transaction(() => {
      const tables = {} as Record<TableName, Record<string, unknown>[]>;
      for (const table of TABLES) {
        tables[table] = this.db.prepare(`SELECT * FROM ${table}`).all() as Record<
          string,
          unknown
        >[];
      }
      const settings = this.db.prepare('SELECT data FROM settings WHERE id = 1').get() as
        { data: string } | undefined;
      return { tables, settings };
    });

    const { tables, settings } = read();
    const parsedSettings = settings ? (JSON.parse(settings.data) as Record<string, unknown>) : {};
    if (!includesSecrets) {
      const ha = (parsedSettings.ha as Record<string, unknown> | undefined) ?? {};
      parsedSettings.ha = { ...ha, token: '' };
    }

    return {
      metadata: {
        app: 'pvm',
        version: VERSION,
        createdAt: new Date().toISOString(),
        revision: Number(parsedSettings.revision ?? 0),
        includesSecrets,
        counts: toCounts(tables),
      },
      settings: parsedSettings,
      tables,
    };
  }

  /** Row counts per table, for the backup preview in the UI. */
  counts(): BackupCounts {
    const tables = {} as Record<TableName, unknown[]>;
    for (const table of TABLES) {
      const row = this.db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
      tables[table] = Array.from({ length: row.c });
    }
    return toCounts(tables);
  }

  /** Validate and restore a backup document, replacing all current data. */
  import(backup: PvmBackup): BackupImportResult {
    this.validate(backup);

    const restore = this.db.transaction(() => {
      for (const table of TABLES) {
        this.db.prepare(`DELETE FROM ${table}`).run();
      }
      for (const table of TABLES) {
        const rows = backup.tables[table] ?? [];
        for (const row of rows) {
          this.insertRow(table, row);
        }
      }
      const settings = backup.settings;
      this.db
        .prepare(
          `INSERT INTO settings (id, data, revision, updated_at) VALUES (1, @data, @revision, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET data=@data, revision=@revision, updated_at=@updatedAt`,
        )
        .run({
          data: JSON.stringify(settings),
          revision: Number(settings.revision ?? 0),
          updatedAt: String(settings.updatedAt ?? new Date().toISOString()),
        });
    });

    restore();
    const imported = toCounts(backup.tables);
    this.log.info('backup', 'Backup restored', { ...imported });
    return { ok: true, imported, message: 'Backup restored' };
  }

  private validate(backup: PvmBackup): void {
    if (!backup || typeof backup !== 'object') {
      throw new PvmError('PVM-021', { reason: 'not-an-object' });
    }
    if (backup.metadata?.app !== 'pvm') {
      throw new PvmError('PVM-021', { reason: 'wrong-app' });
    }
    if (!backup.tables || typeof backup.tables !== 'object') {
      throw new PvmError('PVM-021', { reason: 'missing-tables' });
    }
    if (!backup.settings || typeof backup.settings !== 'object') {
      throw new PvmError('PVM-021', { reason: 'missing-settings' });
    }
    for (const table of TABLES) {
      const rows = backup.tables[table];
      if (rows !== undefined && !Array.isArray(rows)) {
        throw new PvmError('PVM-021', { reason: `bad-table:${table}` });
      }
    }
  }

  /**
   * Insert a row built from an untrusted backup. Only columns that actually
   * exist in the target table are used, which keeps imports forward- and
   * backward-compatible and prevents SQL injection via column names.
   */
  private insertRow(table: TableName, row: Record<string, unknown>): void {
    const columns = (
      this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    ).map((c) => c.name);
    const keys = Object.keys(row).filter((k) => columns.includes(k));
    if (keys.length === 0) return;
    const placeholders = keys.map((k) => `@${k}`).join(', ');
    const values: Record<string, unknown> = {};
    for (const key of keys) {
      const value = row[key];
      values[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    }
    this.db
      .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
      .run(values);
  }
}
