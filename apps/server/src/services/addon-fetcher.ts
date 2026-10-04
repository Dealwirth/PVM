import type { AddonManifest } from '@pvm/shared';
import { PvmError } from '@pvm/shared';
import type { AddonFile, AddonSourceFetcher } from './addon.js';
import type { DevLog } from './devlog.js';

const MANIFEST_FILENAMES = ['pvm-addon.json', 'pvm.json', 'manifest.json'];
const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 20_000;

interface GitHubRef {
  owner: string;
  repo: string;
  ref?: string;
}

/** Parse a GitHub URL into owner/repo[/ref]. */
export function parseGitHubUrl(raw: string): GitHubRef {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PvmError('PVM-011', { reason: 'invalid URL' });
  }
  if (url.hostname !== 'github.com') {
    throw new PvmError('PVM-011', { reason: 'only github.com URLs are supported' });
  }
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const owner = parts[0];
  const repo = parts[1]?.replace(/\.git$/, '');
  if (!owner || !repo) throw new PvmError('PVM-011', { reason: 'owner/repo missing' });
  let ref: string | undefined;
  if (parts[2] === 'tree' && parts[3]) ref = parts.slice(3).join('/');
  return { owner, repo, ref };
}

/**
 * Fetches addon packages from GitHub using the REST API.
 * Only reads public repository contents; nothing is executed.
 */
export class GitHubAddonFetcher implements AddonSourceFetcher {
  constructor(
    private readonly log: DevLog,
    private readonly githubToken?: string,
    private readonly storeRegistryUrl?: string,
  ) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PVM-Store',
    };
    if (this.githubToken) headers.Authorization = `Bearer ${this.githubToken}`;
    return headers;
  }

  private async api<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`https://api.github.com${path}`, {
        headers: this.headers(),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new PvmError('PVM-011', { status: res.status, path });
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof PvmError) throw err;
      throw new PvmError('PVM-002', { path, error: (err as Error).message });
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchManifest(
    source: string,
    version?: string,
  ): Promise<{ manifest: AddonManifest; files: AddonFile[] }> {
    // Store installs reference a manifest id (e.g. "pvm.sensor.pv"); everything
    // else must be a GitHub repository URL.
    if (!/^https?:\/\//i.test(source)) {
      return this.fetchFromStore(source, version);
    }
    const ref = parseGitHubUrl(source);
    const treeRef = version ?? ref.ref ?? 'HEAD';

    const tree = await this.api<{ tree: Array<{ path: string; type: string; size?: number }> }>(
      `/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(treeRef)}?recursive=1`,
    );

    const files: AddonFile[] = [];
    let totalBytes = 0;
    let manifestRaw: string | undefined;

    const blobs = tree.tree.filter((t) => t.type === 'blob').slice(0, MAX_FILES);
    for (const blob of blobs) {
      if (MANIFEST_FILENAMES.includes(blob.path)) {
        manifestRaw = await this.fetchBlob(ref, blob.path);
        continue;
      }
      // Only include source-ish files; skip binaries.
      if (!/\.(js|mjs|cjs|ts|json|md|txt|html|css)$/.test(blob.path)) continue;
      totalBytes += blob.size ?? 0;
      if (totalBytes > MAX_TOTAL_BYTES) break;
      files.push({ path: blob.path, content: await this.fetchBlob(ref, blob.path) });
    }

    if (!manifestRaw) {
      throw new PvmError('PVM-011', { reason: 'no manifest found (pvm-addon.json)' });
    }
    const manifest = JSON.parse(manifestRaw) as AddonManifest;
    manifest.repositoryUrl = source;
    this.log.info('addon', 'Fetched addon package', {
      repo: `${ref.owner}/${ref.repo}`,
      files: files.length,
    });
    return { manifest, files };
  }

  private async fetchFromStore(
    id: string,
    version?: string,
  ): Promise<{ manifest: AddonManifest; files: AddonFile[] }> {
    const store = await this.listStore();
    const manifest = store.find((m) => m.id === id);
    if (!manifest) throw new PvmError('PVM-011', { reason: `unknown store addon: ${id}` });
    if (version && version !== manifest.version) {
      throw new PvmError('PVM-011', { reason: `version ${version} not available for ${id}` });
    }
    this.log.info('addon', 'Resolved store addon', {
      addonId: manifest.id,
      source: manifest.source,
    });
    return { manifest: { ...manifest }, files: [] };
  }

  private async fetchBlob(ref: GitHubRef, path: string): Promise<string> {
    const content = await this.api<{ content: string; encoding: string }>(
      `/repos/${ref.owner}/${ref.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref.ref ?? 'HEAD')}`,
    );
    if (content.encoding === 'base64') {
      return Buffer.from(content.content, 'base64').toString('utf8');
    }
    return content.content;
  }

  async listStore(): Promise<AddonManifest[]> {
    if (!this.storeRegistryUrl) return BUILTIN_STORE;
    try {
      const res = await fetch(this.storeRegistryUrl, { headers: { 'User-Agent': 'PVM-Store' } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as AddonManifest[];
      return Array.isArray(data) ? [...BUILTIN_STORE, ...data] : BUILTIN_STORE;
    } catch (err) {
      this.log.warn('addon', 'Store registry unreachable, using built-in', {
        error: (err as Error).message,
      });
      return BUILTIN_STORE;
    }
  }
}

/** Built-in PVM store registry (versioned manifests). */
export const BUILTIN_STORE: AddonManifest[] = [
  {
    id: 'pvm.dashboard.solar',
    name: 'Solar Dashboard',
    version: '1.0.0',
    author: 'PVM',
    description: 'Erweitertes Dashboard mit PV-Erzeugung, Verbrauch und Autarkiegrad.',
    category: 'dashboard',
    source: 'pvm',
    pvmVersion: '>=1.0.0',
    permissions: ['devices:read', 'forecast:read'],
    entrypoint: 'dist/index.js',
    recommended: true,
    priority: 'essential',
  },
  {
    id: 'pvm.forecast.weather',
    name: 'Wetter-Prognose',
    version: '1.0.0',
    author: 'PVM',
    description: 'Wetterbasierte Ertragsprognose mit Sonneneinstrahlung und Temperatur.',
    category: 'forecast',
    source: 'pvm',
    pvmVersion: '>=1.0.0',
    permissions: ['forecast:read', 'network:outbound'],
    entrypoint: 'dist/index.js',
    recommended: true,
    priority: 'essential',
  },
  {
    id: 'pvm.sensor.pv',
    name: 'PV-Sensor-Bundle',
    version: '1.0.0',
    author: 'PVM',
    description: 'Vorgefertigte Sensormasken und Vorlagen für PV-Wechselrichter.',
    category: 'sensor',
    source: 'pvm',
    pvmVersion: '>=1.0.0',
    permissions: ['devices:read'],
    entrypoint: 'dist/index.js',
    priority: 'standard',
  },
  {
    id: 'pvm.security.audit',
    name: 'Sicherheits-Audit',
    version: '1.0.0',
    author: 'PVM',
    description: 'Erweiterte Sicherheitsprüfungen und Audit-Log für Addons.',
    category: 'security',
    source: 'pvm',
    pvmVersion: '>=1.0.0',
    permissions: ['settings:read', 'log:write'],
    entrypoint: 'dist/index.js',
    priority: 'standard',
  },
  {
    id: 'community.example.hello',
    name: 'Community Beispiel-Addon',
    version: '0.1.0',
    author: 'Community',
    description: 'Beispiel-Addon aus der Community. Zeigt die Addon-Schnittstelle.',
    category: 'community',
    source: 'community',
    pvmVersion: '>=1.0.0',
    permissions: ['log:write'],
    entrypoint: 'dist/index.js',
    priority: 'optional',
  },
];
