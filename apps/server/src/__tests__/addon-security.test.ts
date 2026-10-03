import { describe, expect, it } from 'vitest';
import {
  grantPermissions,
  scanAddon,
  validateManifest,
  packageIntegrity,
} from '../services/addon-security.js';
import { PvmError } from '@pvm/shared';

const validManifest = {
  id: 'test.addon',
  name: 'Test Addon',
  version: '1.0.0',
  author: 'Tester',
  description: 'A test addon',
  category: 'dashboard' as const,
  source: 'github' as const,
  pvmVersion: '>=1.0.0',
  permissions: ['devices:read' as const],
  entrypoint: 'dist/index.js',
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(validateManifest(validManifest).id).toBe('test.addon');
  });

  it('rejects missing fields', () => {
    const { name: _name, ...rest } = validManifest;
    expect(() => validateManifest(rest)).toThrowError(PvmError);
  });

  it('rejects invalid id', () => {
    expect(() => validateManifest({ ...validManifest, id: 'INVALID ID!' })).toThrowError(PvmError);
  });

  it('rejects invalid version', () => {
    expect(() => validateManifest({ ...validManifest, version: 'v1' })).toThrowError(PvmError);
  });

  it('rejects path traversal in entrypoint', () => {
    expect(() => validateManifest({ ...validManifest, entrypoint: '../evil.js' })).toThrowError(
      PvmError,
    );
  });
});

describe('scanAddon', () => {
  it('passes clean code in strict mode', () => {
    const result = scanAddon([{ path: 'index.js', content: 'export const x = 1;' }], 'strict');
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('none');
  });

  it('flags child_process in strict mode', () => {
    const result = scanAddon(
      [{ path: 'index.js', content: "const { exec } = require('child_process');" }],
      'strict',
    );
    expect(result.passed).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('flags credential access as critical even in lenient mode', () => {
    const result = scanAddon(
      [{ path: 'evil.js', content: "readFileSync('/etc/passwd')" }],
      'lenient',
    );
    expect(result.severity).toBe('critical');
    expect(result.passed).toBe(false);
  });

  it('moderate mode allows medium findings', () => {
    const result = scanAddon(
      [{ path: 'index.js', content: 'writeFileSync("a", "b")' }],
      'moderate',
    );
    expect(result.passed).toBe(true);
  });
});

describe('grantPermissions', () => {
  it('strips network:outbound in strict mode', () => {
    expect(grantPermissions(['devices:read', 'network:outbound'], 'strict')).toEqual([
      'devices:read',
    ]);
  });

  it('keeps permissions in moderate mode', () => {
    expect(grantPermissions(['devices:read', 'network:outbound'], 'moderate')).toEqual([
      'devices:read',
      'network:outbound',
    ]);
  });
});

describe('packageIntegrity', () => {
  it('is order independent', () => {
    const a = packageIntegrity([
      { path: 'b.js', content: '2' },
      { path: 'a.js', content: '1' },
    ]);
    const b = packageIntegrity([
      { path: 'a.js', content: '1' },
      { path: 'b.js', content: '2' },
    ]);
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    const a = packageIntegrity([{ path: 'a.js', content: '1' }]);
    const b = packageIntegrity([{ path: 'a.js', content: '2' }]);
    expect(a).not.toBe(b);
  });
});
