import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de.js';
import { en } from '../i18n/en.js';

type Tree = Record<string, unknown>;

function flatten(obj: Tree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') return flatten(value as Tree, path);
    return [path];
  });
}

describe('i18n resources', () => {
  it('German and English expose the same keys', () => {
    const deKeys = flatten(de.translation as unknown as Tree).sort();
    const enKeys = flatten(en.translation as unknown as Tree).sort();
    expect(enKeys).toEqual(deKeys);
  });

  it('has no empty translations', () => {
    for (const [lang, res] of Object.entries({ de, en })) {
      const walk = (node: Tree, path: string): void => {
        for (const [key, value] of Object.entries(node)) {
          const current = `${path}.${key}`;
          if (value && typeof value === 'object') walk(value as Tree, current);
          else expect(String(value).length, `${lang}${current}`).toBeGreaterThan(0);
        }
      };
      walk(res.translation as unknown as Tree, '');
    }
  });
});
