import assert from 'node:assert/strict';
import test from 'node:test';

import { getServerConfig } from '../src/config/database.js';

const base: NodeJS.ProcessEnv = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'ems',
  DB_PASSWORD: 'strong-password',
  DB_PASSWORD_IS_EMPTY: 'false',
};

test('database config requires a password by default', () => {
  assert.throws(() => getServerConfig({ ...base, DB_PASSWORD: '' }));
  assert.equal(getServerConfig(base).password, 'strong-password');
});

test('empty database passwords are limited to non-production compatibility', () => {
  assert.equal(
    getServerConfig({ ...base, DB_PASSWORD_IS_EMPTY: 'true' }).password,
    '',
  );
  assert.throws(() => getServerConfig({
    ...base,
    DB_PASSWORD_IS_EMPTY: 'true',
    NODE_ENV: 'production',
  }));
});

test('production runtime rejects the root database account', () => {
  assert.throws(() => getServerConfig({
    ...base,
    DB_USER: 'root',
    NODE_ENV: 'production',
  }));
});
