import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../../src/modules/auth/auth.errors.js';
import {
  validateCreateProject,
  validateProjectId,
  validateUpdateProject,
} from '../../src/modules/project/project.validator.js';

test('create validator trims name and accepts positive string ID', () => {
  assert.deepEqual(
    validateCreateProject({
      nama_project: '  EMS API  ',
      lead_employee_id: '12',
    }),
    { namaProject: 'EMS API', leadEmployeeId: '12' },
  );
});

test('create validator rejects missing, invalid, and unknown fields', () => {
  const invalidBodies: unknown[] = [
    null,
    {},
    { nama_project: '', lead_employee_id: '1' },
    { nama_project: 'x'.repeat(151), lead_employee_id: '1' },
    { nama_project: 'EMS', lead_employee_id: 1 },
    { nama_project: 'EMS', lead_employee_id: '0' },
    { nama_project: 'EMS', lead_employee_id: '1', extra: true },
  ];
  for (const body of invalidBodies) {
    assert.throws(() => validateCreateProject(body), ValidationError);
  }
});

test('update validator accepts partial fields and rejects empty or unknown body', () => {
  assert.deepEqual(validateUpdateProject({ nama_project: ' New ' }), {
    namaProject: 'New',
  });
  assert.deepEqual(validateUpdateProject({ lead_employee_id: '3' }), {
    leadEmployeeId: '3',
  });
  assert.throws(() => validateUpdateProject({}), ValidationError);
  assert.throws(
    () => validateUpdateProject({ nama_project: 'New', ignored: true }),
    ValidationError,
  );
});

test('project ID validator accepts only positive integer strings', () => {
  assert.equal(validateProjectId('999'), '999');
  for (const value of ['', '0', '-1', '1.5', 'abc']) {
    assert.throws(() => validateProjectId(value), ValidationError);
  }
});
