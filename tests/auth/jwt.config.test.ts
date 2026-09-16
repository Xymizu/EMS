import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHttpPort, parseJwtConfig } from '../../src/config/jwt.js';

const validEnvironment: NodeJS.ProcessEnv = {
  JWT_SECRET: 'configuration-secret-with-at-least-32-characters',
  JWT_ACCESS_TOKEN_TTL_SECONDS: '900',
  JWT_ISSUER: 'ems-api',
  JWT_AUDIENCE: 'ems-client',
  PORT: '3000',
};

test('JWT configuration parses valid environment variables', () => {
  assert.deepEqual(parseJwtConfig(validEnvironment), {
    secret: validEnvironment.JWT_SECRET,
    accessTokenTtlSeconds: 900,
    issuer: 'ems-api',
    audience: 'ems-client',
  });
  assert.equal(parseHttpPort(validEnvironment), 3000);
});

test('JWT configuration rejects missing or invalid values', () => {
  const invalidEnvironments: NodeJS.ProcessEnv[] = [
    { ...validEnvironment, JWT_SECRET: undefined },
    { ...validEnvironment, JWT_SECRET: 'too-short' },
    { ...validEnvironment, JWT_ACCESS_TOKEN_TTL_SECONDS: undefined },
    { ...validEnvironment, JWT_ACCESS_TOKEN_TTL_SECONDS: '0' },
    { ...validEnvironment, JWT_ACCESS_TOKEN_TTL_SECONDS: '1.5' },
    { ...validEnvironment, JWT_ISSUER: '' },
    { ...validEnvironment, JWT_AUDIENCE: '' },
  ];

  for (const environment of invalidEnvironments) {
    assert.throws(() => parseJwtConfig(environment));
  }
  assert.throws(() => parseHttpPort({ ...validEnvironment, PORT: '0' }));
  assert.throws(() => parseHttpPort({ ...validEnvironment, PORT: 'invalid' }));
});
