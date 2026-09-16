import assert from 'node:assert/strict';
import test from 'node:test';

import type { PasswordService } from '../../src/modules/auth/auth.types.js';
import {
  EmployeeNotFoundError,
  ForbiddenError,
} from '../../src/modules/employee/employee.errors.js';
import { createEmployeeService } from '../../src/modules/employee/employee.service.js';
import type {
  EmployeeRepository,
  EmployeeResponse,
  EmployeeRole,
} from '../../src/modules/employee/employee.types.js';

const employee: EmployeeResponse = {
  employeeId: '2',
  userId: '2',
  nama: 'Employee',
  email: 'employee@example.com',
  tanggalMasuk: '2026-01-01',
  role: 'STAFF',
};

function repositoryFor(role: EmployeeRole | null): EmployeeRepository {
  return {
    async findActorRoleByUserId() { return role; },
    async create() { return employee; },
    async findAll() { return [employee]; },
    async findById() { return employee; },
    async update() { return employee; },
  };
}

const passwordService: PasswordService = {
  async compare() { return false; },
  async hash(password) { return `hashed:${password}`; },
};

test('Admin and Super Admin can list employees', async () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
    const service = createEmployeeService(repositoryFor(role), passwordService);
    assert.deepEqual(await service.findAll('1'), [employee]);
  }
});

test('Staff and user without employee are forbidden before target lookup', async () => {
  for (const role of ['STAFF', null] as const) {
    let targetLookedUp = false;
    const repository = repositoryFor(role);
    repository.findById = async () => {
      targetLookedUp = true;
      return null;
    };
    const service = createEmployeeService(repository, passwordService);
    await assert.rejects(service.findById('1', '999'), ForbiddenError);
    assert.equal(targetLookedUp, false);
  }
});

test('create hashes password and never sends plaintext to repository', async () => {
  let receivedHash = '';
  const repository = repositoryFor('ADMIN');
  repository.create = async (input) => {
    receivedHash = input.passwordHash;
    assert.equal('password' in input, false);
    return employee;
  };
  const service = createEmployeeService(repository, passwordService);
  await service.create('1', {
    nama: 'Employee', email: 'employee@example.com', password: 'secret-password',
    tanggalMasuk: '2026-01-01', role: 'STAFF',
  });
  assert.equal(receivedHash, 'hashed:secret-password');
});

test('update only hashes when password is present and maps missing target', async () => {
  let hashes = 0;
  const countingPasswordService: PasswordService = {
    async compare() { return false; },
    async hash(value) { hashes += 1; return `hash:${value}`; },
  };
  const repository = repositoryFor('ADMIN');
  repository.update = async () => null;
  const service = createEmployeeService(repository, countingPasswordService);
  await assert.rejects(service.update('1', '2', { nama: 'New' }), EmployeeNotFoundError);
  assert.equal(hashes, 0);
  await assert.rejects(
    service.update('1', '2', { password: 'new-password' }),
    EmployeeNotFoundError,
  );
  assert.equal(hashes, 1);
});
