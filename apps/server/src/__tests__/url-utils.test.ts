import { describe, expect, it } from 'vitest';
import { isLocalUrl, normalizeUrlInput } from '@pvm/shared';

/**
 * URL helpers used to make HA-URL entry forgiving: users may type a bare
 * hostname (DuckDNS, host.docker.internal) and PVM fills in the scheme.
 */
describe('isLocalUrl', () => {
  it('accepts loopback, .local and RFC1918 hosts', () => {
    for (const url of [
      'http://localhost:8123',
      'http://127.0.0.1:8123',
      'http://homeassistant.local:8123',
      'http://192.168.1.50:8123',
      'http://10.0.0.5:8123',
      'http://172.16.4.1:8123',
      'http://100.64.0.1:8123',
    ]) {
      expect(isLocalUrl(url), url).toBe(true);
    }
  });

  it('rejects public hostnames such as DuckDNS', () => {
    for (const url of [
      'https://myhome.duckdns.org',
      'https://myhome.duckdns.org:8123',
      'http://example.com',
      'http://8.8.8.8:8123',
    ]) {
      expect(isLocalUrl(url), url).toBe(false);
    }
  });
});

describe('normalizeUrlInput', () => {
  it('adds http for local hosts and strips trailing slashes', () => {
    expect(normalizeUrlInput('homeassistant.local:8123/')).toBe('http://homeassistant.local:8123');
    expect(normalizeUrlInput('192.168.1.50:8123')).toBe('http://192.168.1.50:8123');
    expect(normalizeUrlInput('host.docker.internal:8123')).toBe('http://host.docker.internal:8123');
    expect(normalizeUrlInput('http://localhost:8123/')).toBe('http://localhost:8123');
  });

  it('adds https for public hosts (DuckDNS)', () => {
    expect(normalizeUrlInput('myhome.duckdns.org')).toBe('https://myhome.duckdns.org');
    expect(normalizeUrlInput('myhome.duckdns.org:8123')).toBe('https://myhome.duckdns.org:8123');
    expect(normalizeUrlInput('https://myhome.duckdns.org/')).toBe('https://myhome.duckdns.org');
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizeUrlInput('')).toBeNull();
    expect(normalizeUrlInput('   ')).toBeNull();
    expect(normalizeUrlInput('http://')).toBeNull();
  });
});
