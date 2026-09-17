import type { PasswordService } from '../auth/auth.types.js';
import {
  DEFAULT_PAGINATION,
  type Pagination,
} from '../../http/pagination.js';
import {
  EmployeeNotFoundError,
  ForbiddenError,
} from './employee.errors.js';
import type {
  CreateEmployeeInput,
  EmployeeRepository,
  EmployeeResponse,
  UpdateEmployeeInput,
  UpdateEmployeeRecord,
  EmployeeRole,
} from './employee.types.js';

export interface EmployeeService {
  create(actorUserId: string, input: CreateEmployeeInput): Promise<EmployeeResponse>;
  findAll(
    actorUserId: string,
    pagination?: Pagination,
  ): Promise<EmployeeResponse[]>;
  findById(actorUserId: string, employeeId: string): Promise<EmployeeResponse>;
  update(
    actorUserId: string,
    employeeId: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeResponse>;
}

export function createEmployeeService(
  repository: EmployeeRepository,
  passwordService: PasswordService,
): EmployeeService {
  async function actorRole(actorUserId: string): Promise<EmployeeRole> {
    const role = await repository.findActorRoleByUserId(actorUserId);
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') throw new ForbiddenError();
    return role;
  }

  function assertCanAssignRole(
    role: EmployeeRole,
    requestedRole: EmployeeRole,
  ): void {
    if (role === 'ADMIN' && requestedRole === 'SUPER_ADMIN') {
      throw new ForbiddenError();
    }
  }

  return {
    async create(actorUserId, input) {
      const role = await actorRole(actorUserId);
      assertCanAssignRole(role, input.role);
      const { password, ...record } = input;
      return repository.create({
        ...record,
        passwordHash: await passwordService.hash(password),
      });
    },

    async findAll(actorUserId, pagination = DEFAULT_PAGINATION) {
      await actorRole(actorUserId);
      return repository.findAll(pagination);
    },

    async findById(actorUserId, employeeId) {
      await actorRole(actorUserId);
      const employee = await repository.findById(employeeId);
      if (!employee) throw new EmployeeNotFoundError();
      return employee;
    },

    async update(actorUserId, employeeId, input) {
      const role = await actorRole(actorUserId);
      if (input.role !== undefined) {
        if (role !== 'SUPER_ADMIN') throw new ForbiddenError();
        const target = await repository.findById(employeeId);
        if (!target) throw new EmployeeNotFoundError();
        if (target.userId === actorUserId && target.role !== input.role) {
          throw new ForbiddenError();
        }
      }
      const { password, ...fields } = input;
      const record: UpdateEmployeeRecord = { ...fields };
      if (password !== undefined) record.passwordHash = await passwordService.hash(password);
      const employee = await repository.update(employeeId, record);
      if (!employee) throw new EmployeeNotFoundError();
      return employee;
    },
  };
}
