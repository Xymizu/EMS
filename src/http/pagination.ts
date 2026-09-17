import { ValidationError } from '../modules/auth/auth.errors.js';

export interface Pagination {
  limit: number;
  offset: number;
}

export const DEFAULT_PAGINATION: Readonly<Pagination> = {
  limit: 50,
  offset: 0,
};

const QUERY_FIELDS = new Set(['limit', 'offset']);

export function validatePagination(query: unknown): Pagination {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw new ValidationError();
  }
  const input = query as Record<string, unknown>;
  if (Object.keys(input).some((key) => !QUERY_FIELDS.has(key))) {
    throw new ValidationError();
  }

  return {
    limit: parseInteger(input.limit, DEFAULT_PAGINATION.limit, 1, 100),
    offset: parseInteger(input.offset, DEFAULT_PAGINATION.offset, 0, 1_000_000),
  };
}

function parseInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ValidationError();
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ValidationError();
  }
  return parsed;
}
