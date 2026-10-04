import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TokenPayload {
  sub: string;
  role: 'admin' | 'viewer';
  iat: number;
  exp: number;
}

/**
 * Minimal stateless token issuer/verifier (HMAC-SHA256).
 *
 * The token is derived from the configured PVM_API_SECRET. It is intentionally
 * simple so it can be verified without a database round-trip.
 */
export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds = 60 * 60 * 24 * 7,
  ) {
    if (!secret || secret.length < 16) {
      // Weak/missing secret => tokens are disabled; callers must handle 401.
    }
  }

  get enabled(): boolean {
    return Boolean(this.secret && this.secret.length >= 16);
  }

  issue(subject = 'admin', role: 'admin' | 'viewer' = 'admin'): string {
    const payload: TokenPayload = {
      sub: subject,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.ttlSeconds,
    };
    const body = base64url(JSON.stringify(payload));
    const sig = this.sign(body);
    return `${body}.${sig}`;
  }

  verify(token: string): TokenPayload | null {
    if (!this.enabled) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts as [string, string];
    const expected = this.sign(body);
    if (!safeEqual(sig, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
      if (payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  /** Validate a raw bearer token, accepting either an issued token or the secret itself. */
  authenticate(authorization: string | undefined): TokenPayload | null {
    if (!authorization) return null;
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (!match) return null;
    const token = match[1]!;
    if (this.enabled && safeEqual(token, this.secret)) {
      return { sub: 'admin', role: 'admin', iat: 0, exp: Number.MAX_SAFE_INTEGER };
    }
    return this.verify(token);
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
