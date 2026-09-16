import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeJwt, SignJWT } from 'jose';

import type { JwtConfig } from '../../src/config/jwt.js';
import { UnauthorizedError } from '../../src/modules/auth/auth.errors.js';
import { createTokenService } from '../../src/modules/auth/token.service.js';

const config: JwtConfig = {
  secret: 'unit-test-secret-with-at-least-32-characters',
  accessTokenTtlSeconds: 900,
  issuer: 'ems-api',
  audience: 'ems-client',
};

test('token service signs a verifiable JWT with required claims', async () => {
  const service = createTokenService(config);
  const before = Math.floor(Date.now() / 1000);
  const token = await service.sign({ userId: '9007199254740993' });
  const after = Math.floor(Date.now() / 1000);
  const payload = decodeJwt(token);

  assert.deepEqual(await service.verify(token), {
    userId: '9007199254740993',
  });
  assert.equal(payload.sub, '9007199254740993');
  assert.equal(payload.iss, config.issuer);
  assert.equal(payload.aud, config.audience);
  assert.ok(payload.iat !== undefined && payload.iat >= before && payload.iat <= after);
  assert.equal(payload.exp, (payload.iat ?? 0) + config.accessTokenTtlSeconds);
});

test('token service rejects invalid tokens', async (suite) => {
  const service = createTokenService(config);
  const validSecret = new TextEncoder().encode(config.secret);
  const otherSecret = new TextEncoder().encode(
    'different-test-secret-with-32-characters',
  );
  const now = Math.floor(Date.now() / 1000);

  const cases = [
    ['malformed', 'not-a-jwt'],
    [
      'wrong signature',
      await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('1')
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(otherSecret),
    ],
    [
      'wrong algorithm',
      await new SignJWT({})
        .setProtectedHeader({ alg: 'HS384' })
        .setSubject('1')
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(validSecret),
    ],
    [
      'wrong issuer',
      await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('1')
        .setIssuer('other-api')
        .setAudience(config.audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(validSecret),
    ],
    [
      'wrong audience',
      await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('1')
        .setIssuer(config.issuer)
        .setAudience('other-client')
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(validSecret),
    ],
    [
      'expired',
      await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('1')
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt(now - 120)
        .setExpirationTime(now - 60)
        .sign(validSecret),
    ],
    [
      'missing subject',
      await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(validSecret),
    ],
    [
      'invalid subject',
      await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('0')
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(validSecret),
    ],
  ] as const;

  for (const [name, token] of cases) {
    await suite.test(name, async () => {
      await assert.rejects(service.verify(token), UnauthorizedError);
    });
  }
});
