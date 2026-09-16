import type { PasswordService } from '../auth/auth.types.js';
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
} from './employee.types.js';

export interface EmployeeService {
  create(actorUserId: string, input: CreateEmployeeInput): Promise<EmployeeResponse>;
  findAll(actorUserId: string): Promise<EmployeeResponse[]>;
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
  async function assertCanManageEmployees(actorUserId: string): Promise<void> {
    const role = await repository.findActorRoleByUserId(actorUserId);
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') throw new ForbiddenError();
  }

  return {
    async create(actorUserId, input) {
      await assertCanManageEmployees(actorUserId);
      const { password, ...record } = input;
      return repository.create({
        ...record,
        passwordHash: await passwordService.hash(password),
      });
    },

    async findAll(actorUserId) {
      await assertCanManageEmployees(actorUserId);
      return repository.findAll();
    },

    async findById(actorUserId, employeeId) {
      await assertCanManageEmployees(actorUserId);
      const employee = await repository.findById(employeeId);
      if (!employee) throw new EmployeeNotFoundError();
      return employee;
    },

    async update(actorUserId, employeeId, input) {
      await assertCanManageEmployees(actorUserId);
      const { password, ...fields } = input;
      const record: UpdateEmployeeRecord = { ...fields };
      if (password !== undefined) record.passwordHash = await passwordService.hash(password);
      const employee = await repository.update(employeeId, record);
      if (!employee) throw new EmployeeNotFoundError();
      return employee;
    },
  };
}
