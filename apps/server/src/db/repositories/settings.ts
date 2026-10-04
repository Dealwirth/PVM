import type { Settings } from '@pvm/shared';
import type { Db } from '../index.js';

interface SettingsRow {
  data: string;
  revision: number;
  updated_at: string;
}

export class SettingsRepository {
  constructor(private readonly db: Db) {}

  get(): Settings | undefined {
    const row = this.db.prepare('SELECT * FROM settings WHERE id = 1').get() as
      SettingsRow | undefined;
    if (!row) return undefined;
    return JSON.parse(row.data) as Settings;
  }

  save(settings: Settings): Settings {
    this.db
      .prepare(
        `INSERT INTO settings (id, data, revision, updated_at) VALUES (1, @data, @revision, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET data=@data, revision=@revision, updated_at=@updatedAt`,
      )
      .run({
        data: JSON.stringify(settings),
        revision: settings.revision,
        updatedAt: settings.updatedAt,
      });
    return settings;
  }
}
