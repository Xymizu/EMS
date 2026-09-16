import { ValidationError } from '../auth/auth.errors.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from './project.types.js';

const ID_PATTERN = /^[1-9]\d*$/;
const CREATE_FIELDS = new Set(['nama_project', 'lead_employee_id']);

function objectInput(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError();
  }
  return body as Record<string, unknown>;
}

function rejectUnknownFields(input: Record<string, unknown>): void {
  if (Object.keys(input).some((field) => !CREATE_FIELDS.has(field))) {
    throw new ValidationError();
  }
}

function validateName(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError();
  const name = value.trim();
  if (name.length === 0 || name.length > 150) throw new ValidationError();
  return name;
}

function validateId(value: unknown): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new ValidationError();
  }
  return value;
}

export function validateProjectId(value: string): string {
  return validateId(value);
}

export function validateCreateProject(body: unknown): CreateProjectInput {
  const input = objectInput(body);
  rejectUnknownFields(input);
  return {
    namaProject: validateName(input.nama_project),
    leadEmployeeId: validateId(input.lead_employee_id),
  };
}

export function validateUpdateProject(body: unknown): UpdateProjectInput {
  const input = objectInput(body);
  rejectUnknownFields(input);
  const output: UpdateProjectInput = {};
  if ('nama_project' in input) output.namaProject = validateName(input.nama_project);
  if ('lead_employee_id' in input) {
    output.leadEmployeeId = validateId(input.lead_employee_id);
  }
  if (Object.keys(output).length === 0) throw new ValidationError();
  return output;
}
