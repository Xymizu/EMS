import assert from 'node:assert/strict';
import test from 'node:test';

import { ValidationError } from '../../src/modules/auth/auth.errors.js';
import {
  validateCreateTask,
  validateTaskId,
  validateUpdateTask,
} from '../../src/modules/task/task.validator.js';

test('create task validator trims valid input', () => {
  assert.deepEqual(validateCreateTask({
    nama_task: '  Login page  ',
    assigned_employee_id: '2',
  }), {
    namaTask: 'Login page',
    assignedEmployeeId: '2',
  });
});

test('create task validator rejects invalid and unknown fields', () => {
  const invalid: unknown[] = [
    null,
    [],
    {},
    { nama_task: '', assigned_employee_id: '2' },
    { nama_task: 'x'.repeat(201), assigned_employee_id: '2' },
    { nama_task: 'Task', assigned_employee_id: 2 },
    { nama_task: 'Task', assigned_employee_id: '0' },
    { nama_task: 'Task', assigned_employee_id: '2', status: 'DONE' },
  ];
  for (const input of invalid) {
    assert.throws(() => validateCreateTask(input), ValidationError);
  }
});

test('update task validator accepts partial input and rejects forbidden fields', () => {
  assert.deepEqual(validateUpdateTask({ nama_task: ' New ' }), { namaTask: 'New' });
  assert.deepEqual(validateUpdateTask({ assigned_employee_id: '3' }), {
    assignedEmployeeId: '3',
  });
  for (const input of [
    {},
    { assigned_employee_id: null },
    { status: 'DONE' },
    { project_id: '2' },
    { nama_task: 'New', ignored: true },
  ]) {
    assert.throws(() => validateUpdateTask(input), ValidationError);
  }
});

test('task ID only accepts positive integer strings', () => {
  assert.equal(validateTaskId('123'), '123');
  for (const input of ['', '0', '-1', '1.5', 'abc']) {
    assert.throws(() => validateTaskId(input), ValidationError);
  }
});
