/** PVM-Store (addon system) domain types. */

export const ADDON_CATEGORIES = [
  'api',
  'dashboard',
  'sensor',
  'forecast',
  'security',
  'integration',
  'automation',
  'community',
  'other',
] as const;
export type AddonCategory = (typeof ADDON_CATEGORIES)[number];

export const ADDON_STATUSES = [
  'available',
  'installed',
  'enabled',
  'disabled',
  'error',
  'update_available',
  'quarantined',
] as const;
export type AddonStatus = (typeof ADDON_STATUSES)[number];

export const ADDON_SOURCES = ['pvm', 'community', 'github'] as const;
export type AddonSource = (typeof ADDON_SOURCES)[number];

export const SECURITY_MODES = ['strict', 'moderate', 'lenient'] as const;
export type SecurityMode = (typeof SECURITY_MODES)[number];

/** Permissions an addon may request. Only these are ever granted. */
export const ADDON_PERMISSIONS = [
  'devices:read',
  'devices:write',
  'forecast:read',
  'calendar:read',
  'calendar:write',
  'store:read',
  'settings:read',
  'network:outbound',
  'storage:local',
  'log:write',
] as const;
export type AddonPermission = (typeof ADDON_PERMISSIONS)[number];

/** Manifest describing an addon, fetched from a GitHub repository. */
export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: AddonCategory;
  source: AddonSource;
  /** Repository URL the addon was installed from. */
  repositoryUrl?: string;
  homepage?: string;
  license?: string;
  /** PVM API version the addon targets, semver range. */
  pvmVersion: string;
  /** Minimum PVM version required. */
  minPvmVersion?: string;
  permissions: AddonPermission[];
  /** Entry point relative to the addon root, e.g. dist/index.js. */
  entrypoint: string;
  /** Declared dependencies on other addon ids with semver ranges. */
  dependencies?: Record<string, string>;
  /** Arbitrary addon config schema (JSON schema subset). */
  configSchema?: Record<string, unknown>;
  /** Declared integrity hash of the package, if provided. */
  integrity?: string;
  /** Marks the addon as recommended (shown first, "empfohlen"). */
  recommended?: boolean;
  /** Relative priority for store sorting. */
  priority?: 'essential' | 'standard' | 'optional';
}

export interface AddonConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'secret';
  required: boolean;
  default?: unknown;
  options?: string[];
  description?: string;
}

/** An installed addon instance. */
export interface InstalledAddon {
  id: string;
  manifest: AddonManifest;
  status: AddonStatus;
  installedAt: string;
  updatedAt: string;
  /** User configuration values. */
  config: Record<string, unknown>;
  /** Effective granted permissions (intersection of requested + allowed). */
  grantedPermissions: AddonPermission[];
  enabled: boolean;
  /** Install path relative to the addons directory. */
  installPath: string;
  lastError?: string;
  /** Version that is available for update, if any. */
  availableVersion?: string;
}

export interface SecurityScanResult {
  passed: boolean;
  /** Individual findings. */
  findings: SecurityFinding[];
  /** Highest severity found. */
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  scannedAt: string;
}

export interface SecurityFinding {
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  file?: string;
  line?: number;
}

export interface AddonInstallRequest {
  /** GitHub repository URL or a PVM store addon id. */
  source: string;
  /** Optional explicit version/tag/ref. */
  version?: string;
  config?: Record<string, unknown>;
}
