import type { AddonPermission, InstalledAddon } from '@pvm/shared';
import type { Db } from '../index.js';

interface AddonRow {
  id: string;
  manifest: string;
  status: string;
  installed_at: string;
  updated_at: string;
  config: string;
  granted_permissions: string;
  enabled: number;
  install_path: string;
  last_error: string | null;
  available_version: string | null;
}

function rowToAddon(row: AddonRow): InstalledAddon {
  return {
    id: row.id,
    manifest: JSON.parse(row.manifest) as InstalledAddon['manifest'],
    status: row.status as InstalledAddon['status'],
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
    config: JSON.parse(row.config) as Record<string, unknown>,
    grantedPermissions: JSON.parse(row.granted_permissions) as AddonPermission[],
    enabled: row.enabled === 1,
    installPath: row.install_path,
    lastError: row.last_error ?? undefined,
    availableVersion: row.available_version ?? undefined,
  };
}

export class AddonRepository {
  constructor(private readonly db: Db) {}

  list(): InstalledAddon[] {
    const rows = this.db
      .prepare('SELECT * FROM addons ORDER BY installed_at DESC')
      .all() as AddonRow[];
    return rows.map(rowToAddon);
  }

  get(id: string): InstalledAddon | undefined {
    const row = this.db.prepare('SELECT * FROM addons WHERE id = ?').get(id) as
      AddonRow | undefined;
    return row ? rowToAddon(row) : undefined;
  }

  save(addon: InstalledAddon): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO addons (id, manifest, status, installed_at, updated_at, config,
          granted_permissions, enabled, install_path, last_error, available_version)
         VALUES (@id, @manifest, @status, @installedAt, @updatedAt, @config, @grantedPermissions,
          @enabled, @installPath, @lastError, @availableVersion)`,
      )
      .run({
        id: addon.id,
        manifest: JSON.stringify(addon.manifest),
        status: addon.status,
        installedAt: addon.installedAt,
        updatedAt: addon.updatedAt,
        config: JSON.stringify(addon.config),
        grantedPermissions: JSON.stringify(addon.grantedPermissions),
        enabled: addon.enabled ? 1 : 0,
        installPath: addon.installPath,
        lastError: addon.lastError ?? null,
        availableVersion: addon.availableVersion ?? null,
      });
  }

  remove(id: string): boolean {
    return this.db.prepare('DELETE FROM addons WHERE id = ?').run(id).changes > 0;
  }
}
