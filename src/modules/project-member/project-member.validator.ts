import { ValidationError } from '../auth/auth.errors.js';
import { validateEmployeeId } from '../employee/employee.validator.js';
import { validateProjectId } from '../project/project.validator.js';
import type { AddProjectMemberInput } from './project-member.types.js';

export { validateEmployeeId, validateProjectId };

export function validateAddProjectMember(body: unknown): AddProjectMemberInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError();
  }
  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'employee_id') ||
    typeof input.employee_id !== 'string'
  ) {
    throw new ValidationError();
  }
  return { employeeId: validateEmployeeId(input.employee_id) };
}
