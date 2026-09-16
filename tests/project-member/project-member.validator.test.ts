import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../../src/modules/auth/auth.errors.js';
import {
  validateAddProjectMember,
  validateEmployeeId,
  validateProjectId,
} from '../../src/modules/project-member/project-member.validator.js';

test('add member validator accepts one positive string employee ID', () => {
  assert.deepEqual(validateAddProjectMember({ employee_id: '12' }), {
    employeeId: '12',
  });
});

test('add member validator rejects malformed input and unknown fields', () => {
  const invalid: unknown[] = [
    null,
    [],
    '2',
    {},
    { employee_id: 2 },
    { employee_id: '0' },
    { employee_id: '2', ignored: true },
  ];
  for (const input of invalid) {
    assert.throws(() => validateAddProjectMember(input), ValidationError);
  }
});

test('project and employee path IDs only accept positive integer strings', () => {
  assert.equal(validateProjectId('1'), '1');
  assert.equal(validateEmployeeId('999'), '999');
  for (const input of ['', '0', '-1', '1.5', 'abc']) {
    assert.throws(() => validateProjectId(input), ValidationError);
    assert.throws(() => validateEmployeeId(input), ValidationError);
  }
});
