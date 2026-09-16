import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canTransitionTaskStatus,
  canUpdateTaskStatus,
} from '../../src/modules/task/task-status.policy.js';
import type { TaskStatus } from '../../src/modules/task/task.types.js';

test('task status authorization allows assignee, project lead, Admin, and Super Admin', () => {
  assert.equal(canUpdateTaskStatus({
    actorEmployeeId: '2', actorRole: 'STAFF',
    assignedEmployeeId: '2', leadEmployeeId: '3',
  }), true);
  assert.equal(canUpdateTaskStatus({
    actorEmployeeId: '3', actorRole: 'STAFF',
    assignedEmployeeId: '2', leadEmployeeId: '3',
  }), true);
  for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
    assert.equal(canUpdateTaskStatus({
      actorEmployeeId: '9', actorRole: role,
      assignedEmployeeId: '2', leadEmployeeId: '3',
    }), true);
  }
});

test('task status authorization rejects unrelated Staff', () => {
  assert.equal(canUpdateTaskStatus({
    actorEmployeeId: '9', actorRole: 'STAFF',
    assignedEmployeeId: '2', leadEmployeeId: '3',
  }), false);
});

test('task status transition policy exhaustively covers all status pairs', () => {
  const statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
  const allowed = new Set([
    'TODO:IN_PROGRESS',
    'IN_PROGRESS:TODO',
    'IN_PROGRESS:DONE',
    'DONE:IN_PROGRESS',
  ]);
  for (const current of statuses) {
    for (const target of statuses) {
      assert.equal(
        canTransitionTaskStatus(current, target),
        allowed.has(`${current}:${target}`),
        `${current} -> ${target}`,
      );
    }
  }
});
