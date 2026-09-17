import { ValidationError } from '../auth/auth.errors.js';
import type {
  CreateEmployeeInput,
  EmployeeRole,
  UpdateEmployeeInput,
} from './employee.types.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPLOYEE_ID_PATTERN = /^[1-9]\d*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ROLES = new Set<EmployeeRole>(['STAFF', 'ADMIN', 'SUPER_ADMIN']);
const FIELDS = new Set(['nama', 'email', 'password', 'tanggal_masuk', 'role']);

function objectInput(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError();
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((field) => !FIELDS.has(field))) {
    throw new ValidationError();
  }
  return input;
}

function validateNama(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError();
  const nama = value.trim();
  if (nama.length === 0 || nama.length > 100) throw new ValidationError();
  return nama;
}

function validateEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError();
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError();
  }
  return email;
}

function validatePassword(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError();
  if (value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new ValidationError();
  }
  return value;
}

function validateDate(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError();
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new ValidationError();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError();
  }
  return value;
}

function validateRole(value: unknown): EmployeeRole {
  if (typeof value !== 'string' || !ROLES.has(value as EmployeeRole)) {
    throw new ValidationError();
  }
  return value as EmployeeRole;
}

export function validateEmployeeId(value: string): string {
  if (!EMPLOYEE_ID_PATTERN.test(value)) throw new ValidationError();
  return value;
}

export function validateCreateEmployee(body: unknown): CreateEmployeeInput {
  const input = objectInput(body);
  return {
    nama: validateNama(input.nama),
    email: validateEmail(input.email),
    password: validatePassword(input.password),
    tanggalMasuk: validateDate(input.tanggal_masuk),
    role: validateRole(input.role),
  };
}

export function validateUpdateEmployee(body: unknown): UpdateEmployeeInput {
  const input = objectInput(body);
  const output: UpdateEmployeeInput = {};
  if ('nama' in input) output.nama = validateNama(input.nama);
  if ('email' in input) output.email = validateEmail(input.email);
  if ('password' in input) output.password = validatePassword(input.password);
  if ('tanggal_masuk' in input) {
    output.tanggalMasuk = validateDate(input.tanggal_masuk);
  }
  if ('role' in input) output.role = validateRole(input.role);
  if (Object.keys(output).length === 0) throw new ValidationError();
  return output;
}
