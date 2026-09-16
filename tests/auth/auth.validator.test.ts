import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../../src/modules/auth/auth.errors.js';
import { validateLoginInput } from '../../src/modules/auth/auth.validator.js';

test('login validator normalizes email without changing password', () => {
  const result = validateLoginInput({
    email: '  User.Name@Example.COM  ',
    password: '  keep-spaces  ',
    ignored: 'field',
  });

  assert.deepEqual(result, {
    email: 'user.name@example.com',
    password: '  keep-spaces  ',
  });
});

test('login validator rejects invalid payloads', async (suite) => {
  const invalidPayloads: unknown[] = [
    null,
    [],
    'string',
    {},
    { email: 'user@example.com' },
    { password: 'password' },
    { email: 123, password: 'password' },
    { email: 'user@example.com', password: 123 },
    { email: '', password: 'password' },
    { email: 'not-an-email', password: 'password' },
    { email: 'user@example.com', password: '' },
    { email: `${'a'.repeat(245)}@example.com`, password: 'password' },
    { email: 'user@example.com', password: 'x'.repeat(1025) },
  ];

  for (const [index, payload] of invalidPayloads.entries()) {
    await suite.test(`rejects invalid payload ${index + 1}`, () => {
      assert.throws(() => validateLoginInput(payload), ValidationError);
    });
  }
});
