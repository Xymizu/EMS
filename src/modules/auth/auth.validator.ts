import { ValidationError } from './auth.errors.js';
import type { LoginInput } from './auth.types.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginInput(body: unknown): LoginInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError();
  }

  const input = body as Record<string, unknown>;
  if (typeof input.email !== 'string' || typeof input.password !== 'string') {
    throw new ValidationError();
  }

  const email = input.email.trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    input.password.length === 0 ||
    input.password.length > 1024
  ) {
    throw new ValidationError();
  }

  return { email, password: input.password };
}
