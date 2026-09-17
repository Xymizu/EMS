import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../../src/modules/auth/auth.errors.js';
import {
  DEFAULT_PAGINATION,
  validatePagination,
} from '../../src/http/pagination.js';

test('pagination uses bounded defaults and parses valid values', () => {
  assert.deepEqual(validatePagination({}), DEFAULT_PAGINATION);
  assert.deepEqual(validatePagination({ limit: '25', offset: '50' }), {
    limit: 25,
    offset: 50,
  });
});

test('pagination rejects unknown, repeated, and out-of-range values', () => {
  const invalid: unknown[] = [
    { limit: '0' },
    { limit: '101' },
    { limit: '1.5' },
    { limit: ['10', '20'] },
    { offset: '-1' },
    { offset: '1000001' },
    { unexpected: '1' },
  ];
  for (const query of invalid) {
    assert.throws(() => validatePagination(query), ValidationError);
  }
});
