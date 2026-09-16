import assert from 'node:assert/strict';
import test from 'node:test';

import { EmployeeNotFoundError, ForbiddenError } from '../../src/modules/employee/employee.errors.js';
import type { EmployeeRepository, EmployeeResponse, EmployeeRole } from '../../src/modules/employee/employee.types.js';
import {
  ProjectLeadCannotBeRemovedError,
  ProjectMemberAlreadyExistsError,
  ProjectMemberHasActiveTasksError,
  ProjectMemberNotFoundError,
} from '../../src/modules/project-member/project-member.errors.js';
import { createProjectMemberService } from '../../src/modules/project-member/project-member.service.js';
import type { ProjectMemberRepository } from '../../src/modules/project-member/project-member.types.js';
import { ProjectNotFoundError } from '../../src/modules/project/project.errors.js';

const member: EmployeeResponse = {
  employeeId: '2', userId: '2', nama: 'Member', email: 'member@example.com',
  tanggalMasuk: '2026-01-01', role: 'STAFF',
};

function roles(role: EmployeeRole | null): Pick<EmployeeRepository, 'findActorRoleByUserId'> {
  return { async findActorRoleByUserId() { return role; } };
}

function repository(): ProjectMemberRepository {
  return {
    async findAll() { return { status: 'ok', members: [member] }; },
    async add() { return { status: 'ok', member }; },
    async remove() { return { status: 'ok' }; },
  };
}

test('Admin and Super Admin can list members', async () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
    const service = createProjectMemberService(repository(), roles(role));
    assert.deepEqual(await service.findAll('1', '1'), [member]);
  }
});

test('Staff and user without employee are forbidden before target lookup', async () => {
  for (const role of ['STAFF', null] as const) {
    let lookedUp = false;
    const target = repository();
    target.findAll = async () => {
      lookedUp = true;
      return { status: 'project-not-found' };
    };
    const service = createProjectMemberService(target, roles(role));
    await assert.rejects(service.findAll('1', '999'), ForbiddenError);
    assert.equal(lookedUp, false);
  }
});

test('service maps list and add repository outcomes', async () => {
  const target = repository();
  const service = createProjectMemberService(target, roles('ADMIN'));
  target.findAll = async () => ({ status: 'project-not-found' });
  await assert.rejects(service.findAll('1', '1'), ProjectNotFoundError);
  target.add = async () => ({ status: 'employee-not-found' });
  await assert.rejects(service.add('1', '1', '2'), EmployeeNotFoundError);
  target.add = async () => ({ status: 'already-exists' });
  await assert.rejects(service.add('1', '1', '2'), ProjectMemberAlreadyExistsError);
});

test('service maps every remove repository outcome', async () => {
  const target = repository();
  const service = createProjectMemberService(target, roles('ADMIN'));
  const cases = [
    ['project-not-found', ProjectNotFoundError],
    ['employee-not-found', EmployeeNotFoundError],
    ['member-not-found', ProjectMemberNotFoundError],
    ['lead-cannot-be-removed', ProjectLeadCannotBeRemovedError],
    ['has-active-tasks', ProjectMemberHasActiveTasksError],
  ] as const;
  for (const [status, ErrorType] of cases) {
    target.remove = async () => ({ status });
    await assert.rejects(service.remove('1', '1', '2'), ErrorType);
  }
});
