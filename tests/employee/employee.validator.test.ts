import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../../src/modules/auth/auth.errors.js';
import {
  validateCreateEmployee,
  validateEmployeeId,
  validateUpdateEmployee,
} from '../../src/modules/employee/employee.validator.js';

test('create employee validator normalizes valid input', () => {
  assert.deepEqual(
    validateCreateEmployee({
      nama: '  Budi Santoso  ',
      email: '  BUDI@Example.COM ',
      password: ' password ',
      tanggal_masuk: '2026-09-16',
      role: 'STAFF',
    }),
    {
      nama: 'Budi Santoso',
      email: 'budi@example.com',
      password: ' password ',
      tanggalMasuk: '2026-09-16',
      role: 'STAFF',
    },
  );
});

test('create employee validator rejects invalid fields', () => {
  const base = {
    nama: 'Budi',
    email: 'budi@example.com',
    password: 'Password123!',
    tanggal_masuk: '2026-09-16',
    role: 'STAFF',
  };
  const invalid = [
    { ...base, nama: ' ' },
    { ...base, nama: 'a'.repeat(101) },
    { ...base, email: 'invalid' },
    { ...base, password: 'short' },
    { ...base, password: '😀'.repeat(19) },
    { ...base, tanggal_masuk: '2026-02-30' },
    { ...base, tanggal_masuk: '16-09-2026' },
    { ...base, role: 'OWNER' },
    { ...base, ignored: true },
  ];
  for (const input of invalid) {
    assert.throws(() => validateCreateEmployee(input), ValidationError);
  }
});

test('employee ID validator only accepts positive integer strings', () => {
  assert.equal(validateEmployeeId('9007199254740993'), '9007199254740993');
  for (const value of ['0', '-1', '1.5', 'abc', '']) {
    assert.throws(() => validateEmployeeId(value), ValidationError);
  }
});

test('update validator requires a valid whitelisted field', () => {
  assert.deepEqual(validateUpdateEmployee({ nama: ' New Name ' }), {
    nama: 'New Name',
  });
  assert.deepEqual(validateUpdateEmployee({ tanggal_masuk: '2026-10-01' }), {
    tanggalMasuk: '2026-10-01',
  });
  assert.throws(() => validateUpdateEmployee({}), ValidationError);
  assert.throws(() => validateUpdateEmployee({ ignored: true }), ValidationError);
  assert.throws(
    () => validateUpdateEmployee({ nama: 'New Name', ignored: true }),
    ValidationError,
  );
  assert.throws(() => validateUpdateEmployee({ role: null }), ValidationError);
});
