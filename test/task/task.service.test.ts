import assert from 'node:assert/strict';
import test from 'node:test';

import { EmployeeNotFoundError, ForbiddenError } from '../../src/modules/employee/employee.errors.js';
import type { EmployeeRepository, EmployeeRole } from '../../src/modules/employee/employee.types.js';
import { ProjectNotFoundError } from '../../src/modules/project/project.errors.js';
import { AssigneeNotProjectMemberError, TaskNotFoundError } from '../../src/modules/task/task.errors.js';
import { createTaskService } from '../../src/modules/task/task.service.js';
import type { TaskRepository, TaskResponse } from '../../src/modules/task/task.types.js';

const task: TaskResponse = {
  taskId: '1', namaTask: 'Task', status: 'TODO',
  project: { projectId: '1', namaProject: 'Project' },
  assignee: {
    employeeId: '2', userId: '2', nama: 'Member', email: 'member@example.com',
    tanggalMasuk: '2026-01-01', role: 'STAFF',
  },
};

function roles(role: EmployeeRole | null): Pick<EmployeeRepository, 'findActorRoleByUserId'> {
  return { async findActorRoleByUserId() { return role; } };
}

function repository(): TaskRepository {
  return {
    async create() { return { status: 'ok', task }; },
    async findAllByProjectId() { return { status: 'ok', tasks: [task] }; },
    async findById() { return task; },
    async update() { return { status: 'ok', task }; },
    async delete() { return true; },
  };
}

test('Admin and Super Admin can list project tasks', async () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
    const service = createTaskService(repository(), roles(role));
    assert.deepEqual(await service.findAllByProjectId('1', '1'), [task]);
  }
});

test('Staff and user without employee are forbidden before target lookup', async () => {
  for (const role of ['STAFF', null] as const) {
    let lookedUp = false;
    const target = repository();
    target.findById = async () => {
      lookedUp = true;
      return null;
    };
    const service = createTaskService(target, roles(role));
    await assert.rejects(service.findById('1', '999'), ForbiddenError);
    assert.equal(lookedUp, false);
  }
});

test('service maps create and list outcomes', async () => {
  const target = repository();
  const service = createTaskService(target, roles('ADMIN'));
  target.create = async () => ({ status: 'project-not-found' });
  await assert.rejects(
    service.create('1', '1', { namaTask: 'Task', assignedEmployeeId: '2' }),
    ProjectNotFoundError,
  );
  target.create = async () => ({ status: 'employee-not-found' });
  await assert.rejects(
    service.create('1', '1', { namaTask: 'Task', assignedEmployeeId: '2' }),
    EmployeeNotFoundError,
  );
  target.create = async () => ({ status: 'assignee-not-project-member' });
  await assert.rejects(
    service.create('1', '1', { namaTask: 'Task', assignedEmployeeId: '2' }),
    AssigneeNotProjectMemberError,
  );
  target.findAllByProjectId = async () => ({ status: 'project-not-found' });
  await assert.rejects(service.findAllByProjectId('1', '1'), ProjectNotFoundError);
});

test('service maps missing detail, update outcomes, and delete target', async () => {
  const target = repository();
  const service = createTaskService(target, roles('ADMIN'));
  target.findById = async () => null;
  await assert.rejects(service.findById('1', '1'), TaskNotFoundError);
  target.update = async () => ({ status: 'task-not-found' });
  await assert.rejects(service.update('1', '1', { namaTask: 'New' }), TaskNotFoundError);
  target.update = async () => ({ status: 'employee-not-found' });
  await assert.rejects(
    service.update('1', '1', { assignedEmployeeId: '2' }),
    EmployeeNotFoundError,
  );
  target.update = async () => ({ status: 'assignee-not-project-member' });
  await assert.rejects(
    service.update('1', '1', { assignedEmployeeId: '2' }),
    AssigneeNotProjectMemberError,
  );
  target.delete = async () => false;
  await assert.rejects(service.delete('1', '1'), TaskNotFoundError);
});
