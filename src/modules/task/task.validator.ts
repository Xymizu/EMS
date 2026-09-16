import { ValidationError } from '../auth/auth.errors.js';
import { validateEmployeeId } from '../employee/employee.validator.js';
import { validateProjectId } from '../project/project.validator.js';
import type {
  CreateTaskInput,
  TaskStatus,
  UpdateTaskInput,
} from './task.types.js';

const ID_PATTERN = /^[1-9]\d*$/;
const FIELDS = new Set(['nama_task', 'assigned_employee_id']);
const TASK_STATUSES = new Set<TaskStatus>(['TODO', 'IN_PROGRESS', 'DONE']);

function objectInput(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError();
  }
  return body as Record<string, unknown>;
}

function rejectUnknownFields(input: Record<string, unknown>): void {
  if (Object.keys(input).some((field) => !FIELDS.has(field))) {
    throw new ValidationError();
  }
}

function validateName(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError();
  const name = value.trim();
  if (name.length === 0 || name.length > 200) throw new ValidationError();
  return name;
}

export { validateEmployeeId, validateProjectId };

export function validateTaskId(value: string): string {
  if (!ID_PATTERN.test(value)) throw new ValidationError();
  return value;
}

export function validateCreateTask(body: unknown): CreateTaskInput {
  const input = objectInput(body);
  rejectUnknownFields(input);
  if (typeof input.assigned_employee_id !== 'string') {
    throw new ValidationError();
  }
  return {
    namaTask: validateName(input.nama_task),
    assignedEmployeeId: validateEmployeeId(input.assigned_employee_id),
  };
}

export function validateUpdateTask(body: unknown): UpdateTaskInput {
  const input = objectInput(body);
  rejectUnknownFields(input);
  const output: UpdateTaskInput = {};
  if ('nama_task' in input) output.namaTask = validateName(input.nama_task);
  if ('assigned_employee_id' in input) {
    if (typeof input.assigned_employee_id !== 'string') {
      throw new ValidationError();
    }
    output.assignedEmployeeId = validateEmployeeId(input.assigned_employee_id);
  }
  if (Object.keys(output).length === 0) throw new ValidationError();
  return output;
}

export function validateTaskStatusUpdate(body: unknown): TaskStatus {
  const input = objectInput(body);
  if (
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'status') ||
    typeof input.status !== 'string' ||
    !TASK_STATUSES.has(input.status as TaskStatus)
  ) {
    throw new ValidationError();
  }
  return input.status as TaskStatus;
}
