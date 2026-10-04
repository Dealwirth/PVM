/**
 * Backup / restore domain types.
 *
 * A backup is a single JSON document containing every user-created record so
 * PVM can be moved to another machine or restored after a mistake. Credentials
 * (HA token) are excluded unless the operator explicitly opts in.
 */

export interface BackupCounts {
  devices: number;
  history: number;
  productionHistory: number;
  forecasts: number;
  plans: number;
  calendarSources: number;
  calendarEvents: number;
  addons: number;
  safetyEvents: number;
}

export interface BackupMetadata {
  /** Format marker; always `pvm`. */
  app: 'pvm';
  /** PVM version that produced the file. */
  version: string;
  /** ISO timestamp of the export. */
  createdAt: string;
  /** Settings revision at export time. */
  revision: number;
  /** Whether secrets (HA token) are included in `settings`. */
  includesSecrets: boolean;
  /** Number of records per table. */
  counts: BackupCounts;
}

/**
 * Raw table rows. The shape mirrors the SQLite columns exactly so a restore is
 * lossless and forward-compatible: unknown extra columns are preserved.
 */
export type BackupRow = Record<string, unknown>;

export interface PvmBackup {
  metadata: BackupMetadata;
  settings: Record<string, unknown>;
  tables: {
    devices: BackupRow[];
    history: BackupRow[];
    production_history: BackupRow[];
    forecasts: BackupRow[];
    load_plans: BackupRow[];
    calendar_sources: BackupRow[];
    calendar_events: BackupRow[];
    addons: BackupRow[];
    safety_events: BackupRow[];
  };
}

export interface BackupImportResult {
  ok: boolean;
  /** Records written per table. */
  imported: BackupCounts;
  message: string;
}
