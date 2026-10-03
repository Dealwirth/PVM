import type {
  AddonManifest,
  AddonPermission,
  SecurityFinding,
  SecurityMode,
  SecurityScanResult,
} from '@pvm/shared';
import { PvmError, sha256 } from '@pvm/shared';

/** Dangerous API patterns that indicate an addon may escape its sandbox. */
const DANGEROUS_PATTERNS: Array<{
  rule: string;
  regex: RegExp;
  severity: SecurityFinding['severity'];
  message: string;
}> = [
  {
    rule: 'child_process',
    regex: /\b(child_process|execSync|spawnSync|exec\(|spawn\()/,
    severity: 'high',
    message: 'Prozess-Ausführung erkannt (child_process).',
  },
  {
    rule: 'eval',
    regex: /\beval\s*\(|\bnew Function\s*\(/,
    severity: 'high',
    message: 'Dynamische Code-Ausführung erkannt (eval/new Function).',
  },
  {
    rule: 'filesystem-write',
    regex: /(writeFileSync|writeFile|unlink|rmSync|rmdir)/,
    severity: 'medium',
    message: 'Schreibzugriff auf das Dateisystem erkannt.',
  },
  {
    rule: 'network-raw',
    regex: /(require\(['"]net['"]\)|from ['"]net['"]|createConnection\()/,
    severity: 'medium',
    message: 'Rohe Netzwerkverbindung erkannt.',
  },
  {
    rule: 'credential-access',
    regex: /(\/etc\/passwd|\/etc\/shadow|\.ssh\/|id_rsa|process\.env\.(PVM_API_SECRET|HA_TOKEN))/,
    severity: 'critical',
    message: 'Zugriff auf Zugangsdaten/Secrets erkannt.',
  },
  {
    rule: 'remote-load',
    regex: /(https?:\/\/[^\s'"]+\.(js|mjs|cjs))|import\s*\(\s*['"]https?:/,
    severity: 'high',
    message: 'Nachladen von remote-Code erkannt.',
  },
  {
    rule: 'obfuscation',
    regex: /(\\x[0-9a-fA-F]{2}){6,}|atob\s*\(/,
    severity: 'medium',
    message: 'Verschleierter/obfuskierter Code erkannt.',
  },
];

const REQUIRED_MANIFEST_FIELDS: Array<keyof AddonManifest> = [
  'id',
  'name',
  'version',
  'author',
  'description',
  'category',
  'pvmVersion',
  'permissions',
  'entrypoint',
];

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** Validate an addon manifest against the schema. Throws PVM-011 on failure. */
export function validateManifest(raw: unknown): AddonManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new PvmError('PVM-011', { reason: 'manifest not an object' });
  }
  const manifest = raw as Partial<AddonManifest>;
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) {
      throw new PvmError('PVM-011', { reason: `missing field: ${field}` });
    }
  }
  if (!ID_PATTERN.test(manifest.id as string)) {
    throw new PvmError('PVM-011', { reason: 'invalid id' });
  }
  if (!VERSION_PATTERN.test(manifest.version as string)) {
    throw new PvmError('PVM-011', { reason: 'invalid version' });
  }
  if (!Array.isArray(manifest.permissions)) {
    throw new PvmError('PVM-011', { reason: 'permissions must be an array' });
  }
  if (typeof manifest.entrypoint !== 'string' || manifest.entrypoint.includes('..')) {
    throw new PvmError('PVM-011', { reason: 'invalid entrypoint' });
  }
  if (manifest.repositoryUrl && !/^https:\/\//.test(manifest.repositoryUrl)) {
    throw new PvmError('PVM-011', { reason: 'repositoryUrl must be https' });
  }
  return manifest as AddonManifest;
}

/**
 * Static security scan of addon source files. Never executes addon code.
 * Findings are graded and compared against the active security mode.
 */
export function scanAddon(
  files: Array<{ path: string; content: string }>,
  mode: SecurityMode,
): SecurityScanResult {
  const findings: SecurityFinding[] = [];

  for (const file of files) {
    if (file.content.length > 5_000_000) {
      findings.push({
        rule: 'oversized-file',
        severity: 'medium',
        message: 'Datei ist ungewöhnlich groß.',
        file: file.path,
      });
      continue;
    }
    const lines = file.content.split('\n');
    for (const pattern of DANGEROUS_PATTERNS) {
      lines.forEach((line, index) => {
        if (pattern.regex.test(line)) {
          findings.push({
            rule: pattern.rule,
            severity: pattern.severity,
            message: pattern.message,
            file: file.path,
            line: index + 1,
          });
        }
      });
    }
  }

  const severity = highestSeverity(findings);
  const passed = isAllowed(severity, mode);

  return {
    passed,
    findings,
    severity,
    scannedAt: new Date().toISOString(),
  };
}

function highestSeverity(findings: SecurityFinding[]): SecurityScanResult['severity'] {
  const order: SecurityScanResult['severity'][] = ['none', 'low', 'medium', 'high', 'critical'];
  let highest: SecurityScanResult['severity'] = 'none';
  for (const f of findings) {
    if (order.indexOf(f.severity) > order.indexOf(highest)) highest = f.severity;
  }
  return highest;
}

function isAllowed(severity: SecurityScanResult['severity'], mode: SecurityMode): boolean {
  switch (mode) {
    case 'strict':
      return severity === 'none' || severity === 'low';
    case 'moderate':
      return severity !== 'critical';
    case 'lenient':
      return severity !== 'critical';
  }
}

/** Compute the set of permissions actually granted, given mode + requested. */
export function grantPermissions(
  requested: AddonPermission[],
  mode: SecurityMode,
): AddonPermission[] {
  const restricted: AddonPermission[] = ['network:outbound'];
  if (mode === 'strict') {
    return requested.filter((p) => !restricted.includes(p));
  }
  return [...requested];
}

export function packageIntegrity(files: Array<{ path: string; content: string }>): string {
  const concatenated = files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => `${f.path}:${f.content}`)
    .join('\n');
  return sha256(concatenated);
}
