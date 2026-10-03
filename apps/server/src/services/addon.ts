import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AddonManifest, InstalledAddon, SecurityScanResult } from '@pvm/shared';
import { PvmError } from '@pvm/shared';
import type { AddonRepository } from '../db/repositories/addons.js';
import type { DevLog } from './devlog.js';
import type { SettingsService } from './settings.js';
import {
  grantPermissions,
  packageIntegrity,
  scanAddon,
  validateManifest,
} from './addon-security.js';

export interface AddonFile {
  path: string;
  content: string;
}

/** Fetches addon manifests + files from GitHub repos or the built-in store. */
export interface AddonSourceFetcher {
  fetchManifest(
    source: string,
    version?: string,
  ): Promise<{ manifest: AddonManifest; files: AddonFile[] }>;
  listStore(): Promise<AddonManifest[]>;
}

/**
 * PVM-Store (separate from the HA add-on store).
 *
 * Installation pipeline:
 *   1. fetch manifest from the source (GitHub URL or store id)
 *   2. validate manifest (schema, version, entrypoint)
 *   3. security scan (static, never executes code)
 *   4. write package to the local addon store
 *   5. apply user configuration
 *   6. activate (isolated) and report the resulting capabilities
 */
export class AddonService {
  constructor(
    private readonly repo: AddonRepository,
    private readonly settings: SettingsService,
    private readonly log: DevLog,
    private readonly addonsDir: string,
    private readonly fetcher: AddonSourceFetcher,
  ) {}

  list(): InstalledAddon[] {
    return this.repo.list();
  }

  get(id: string): InstalledAddon {
    const addon = this.repo.get(id);
    if (!addon) throw new PvmError('PVM-013', { addonId: id }, `Addon ${id} nicht installiert`);
    return addon;
  }

  /** Browse available addons from the built-in store registry. */
  async browse(): Promise<AddonManifest[]> {
    return this.fetcher.listStore();
  }

  async install(
    source: string,
    version?: string,
    config: Record<string, unknown> = {},
  ): Promise<{ addon: InstalledAddon; scan: SecurityScanResult }> {
    // Store/device control requires required settings to be complete.
    this.settings.assertRequired();
    const mode = this.settings.get().safety.mode;

    this.log.info('addon', 'Install started', { source, version });
    const { manifest: rawManifest, files } = await this.fetcher.fetchManifest(source, version);
    const manifest = validateManifest(rawManifest);

    const scan = scanAddon(files, mode);
    if (!scan.passed) {
      this.log.error(
        'addon',
        'Security scan failed',
        { addonId: manifest.id, severity: scan.severity },
        'PVM-012',
      );
      throw new PvmError('PVM-012', { addonId: manifest.id, scan });
    }

    const integrity = packageIntegrity(files);
    if (manifest.integrity && manifest.integrity !== integrity) {
      this.log.error('addon', 'Integrity mismatch', { addonId: manifest.id }, 'PVM-012');
      throw new PvmError('PVM-012', { addonId: manifest.id, reason: 'integrity mismatch' });
    }

    const installPath = resolve(this.addonsDir, manifest.id);
    this.writePackage(installPath, files, manifest);

    const now = new Date().toISOString();
    const existing = this.repo.get(manifest.id);
    const addon: InstalledAddon = {
      id: manifest.id,
      manifest,
      status: 'enabled',
      installedAt: existing?.installedAt ?? now,
      updatedAt: now,
      config: { ...config },
      grantedPermissions: grantPermissions(manifest.permissions, mode),
      enabled: true,
      installPath,
    };
    this.repo.save(addon);
    this.log.info('addon', 'Install completed', {
      addonId: manifest.id,
      version: manifest.version,
      granted: addon.grantedPermissions,
    });
    return { addon, scan };
  }

  async update(id: string): Promise<InstalledAddon> {
    const existing = this.get(id);
    const result = await this.install(
      existing.manifest.repositoryUrl ?? id,
      existing.availableVersion,
      existing.config,
    );
    return result.addon;
  }

  remove(id: string): void {
    const addon = this.get(id);
    try {
      if (existsSync(addon.installPath))
        rmSync(addon.installPath, { recursive: true, force: true });
    } catch (err) {
      this.log.warn('addon', 'Failed to remove files', {
        addonId: id,
        error: (err as Error).message,
      });
    }
    this.repo.remove(id);
    this.log.info('addon', 'Addon removed', { addonId: id });
  }

  setEnabled(id: string, enabled: boolean): InstalledAddon {
    const addon = this.get(id);
    const updated: InstalledAddon = {
      ...addon,
      enabled,
      status: enabled ? 'enabled' : 'disabled',
      updatedAt: new Date().toISOString(),
    };
    this.repo.save(updated);
    return updated;
  }

  updateConfig(id: string, config: Record<string, unknown>): InstalledAddon {
    const addon = this.get(id);
    const updated: InstalledAddon = { ...addon, config, updatedAt: new Date().toISOString() };
    this.repo.save(updated);
    this.log.info('addon', 'Addon config updated', { addonId: id });
    return updated;
  }

  reportError(id: string, message: string): void {
    const addon = this.get(id);
    this.repo.save({
      ...addon,
      status: 'error',
      lastError: message,
      updatedAt: new Date().toISOString(),
    });
    this.log.error('addon', 'Addon error reported', { addonId: id, message }, 'PVM-013');
  }

  private writePackage(installPath: string, files: AddonFile[], manifest: AddonManifest): void {
    // Guard against path traversal: every file must stay inside installPath.
    const root = resolve(installPath);
    mkdirSync(root, { recursive: true });
    for (const file of files) {
      const target = resolve(root, file.path);
      if (!target.startsWith(root)) {
        throw new PvmError('PVM-011', { reason: `path traversal: ${file.path}` });
      }
      const dir = target.slice(0, target.lastIndexOf('/'));
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(target, file.content);
    }
    writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
    writeFileSync(
      join(root, 'PERMISSIONS.json'),
      JSON.stringify(
        { requested: manifest.permissions, generatedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
  }

  /** Read the addon's own logs, if it wrote any. */
  readAddonLog(id: string): string {
    const addon = this.get(id);
    const logPath = join(addon.installPath, 'addon.log');
    if (!existsSync(logPath)) return '';
    return readFileSync(logPath, 'utf8');
  }
}
