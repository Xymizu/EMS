import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenError } from '../../src/modules/employee/employee.errors.js';
import type {
  EmployeeRepository,
  EmployeeRole,
} from '../../src/modules/employee/employee.types.js';
import {
  LeadEmployeeNotFoundError,
  ProjectNotFoundError,
} from '../../src/modules/project/project.errors.js';
import { createProjectService } from '../../src/modules/project/project.service.js';
import type {
  ProjectRepository,
  ProjectResponse,
} from '../../src/modules/project/project.types.js';

const project: ProjectResponse = {
  projectId: '1',
  namaProject: 'EMS',
  lead: {
    employeeId: '2', userId: '2', nama: 'Lead', email: 'lead@example.com',
    tanggalMasuk: '2026-01-01', role: 'STAFF',
  },
};

function roleRepository(role: EmployeeRole | null): Pick<
  EmployeeRepository,
  'findActorRoleByUserId'
> {
  return { async findActorRoleByUserId() { return role; } };
}

function projectRepository(): ProjectRepository {
  return {
    async create() { return project; },
    async findAll() { return [project]; },
    async findById() { return project; },
    async update() { return project; },
    async delete() { return true; },
  };
}

test('Admin and Super Admin can list projects', async () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
    const service = createProjectService(projectRepository(), roleRepository(role));
    assert.deepEqual(await service.findAll('1'), [project]);
  }
});

test('Staff and user without employee are forbidden before target lookup', async () => {
  for (const role of ['STAFF', null] as const) {
    let targetLookedUp = false;
    const repository = projectRepository();
    repository.findById = async () => {
      targetLookedUp = true;
      return null;
    };
    const service = createProjectService(repository, roleRepository(role));
    await assert.rejects(service.findById('1', '999'), ForbiddenError);
    assert.equal(targetLookedUp, false);
  }
});

test('create maps a missing lead employee', async () => {
  const repository = projectRepository();
  repository.create = async () => null;
  const service = createProjectService(repository, roleRepository('ADMIN'));
  await assert.rejects(
    service.create('1', { namaProject: 'EMS', leadEmployeeId: '999' }),
    LeadEmployeeNotFoundError,
  );
});

test('update distinguishes missing project and missing lead', async () => {
  const repository = projectRepository();
  const service = createProjectService(repository, roleRepository('ADMIN'));
  repository.update = async () => null;
  await assert.rejects(
    service.update('1', '999', { namaProject: 'New' }),
    ProjectNotFoundError,
  );
  repository.update = async () => 'LEAD_NOT_FOUND';
  await assert.rejects(
    service.update('1', '1', { leadEmployeeId: '999' }),
    LeadEmployeeNotFoundError,
  );
});

test('delete maps a missing project', async () => {
  const repository = projectRepository();
  repository.delete = async () => false;
  const service = createProjectService(repository, roleRepository('ADMIN'));
  await assert.rejects(service.delete('1', '999'), ProjectNotFoundError);
});
