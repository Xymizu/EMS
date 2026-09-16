import type { ErrorRequestHandler, RequestHandler } from 'express';

import {
  InvalidCredentialsError,
  UnauthorizedError,
  ValidationError,
} from '../modules/auth/auth.errors.js';
import {
  EmailAlreadyExistsError,
  EmployeeNotFoundError,
  ForbiddenError,
} from '../modules/employee/employee.errors.js';
import {
  LeadEmployeeNotFoundError,
  ProjectHasDependenciesError,
  ProjectNotFoundError,
} from '../modules/project/project.errors.js';
import {
  ProjectLeadCannotBeRemovedError,
  ProjectMemberAlreadyExistsError,
  ProjectMemberHasActiveTasksError,
  ProjectMemberNotFoundError,
} from '../modules/project-member/project-member.errors.js';
import {
  AssigneeNotProjectMemberError,
  InvalidTaskStatusTransitionError,
  TaskNotFoundError,
} from '../modules/task/task.errors.js';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Resource not found' },
  });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  void next;
  if (error instanceof ValidationError || isMalformedJsonError(error)) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request' },
    });
    return;
  }

  if (error instanceof AssigneeNotProjectMemberError) {
    response.status(400).json({
      error: {
        code: 'ASSIGNEE_NOT_PROJECT_MEMBER',
        message: 'Assignee must be a project member',
      },
    });
    return;
  }

  if (error instanceof InvalidTaskStatusTransitionError) {
    response.status(400).json({
      error: {
        code: 'INVALID_TASK_STATUS_TRANSITION',
        message: 'Invalid task status transition',
      },
    });
    return;
  }

  if (error instanceof InvalidCredentialsError) {
    response.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });
    return;
  }

  if (error instanceof UnauthorizedError) {
    response.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  if (error instanceof ForbiddenError) {
    response.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
    return;
  }

  if (error instanceof EmployeeNotFoundError) {
    response.status(404).json({
      error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' },
    });
    return;
  }

  if (error instanceof ProjectNotFoundError) {
    response.status(404).json({
      error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' },
    });
    return;
  }

  if (error instanceof LeadEmployeeNotFoundError) {
    response.status(404).json({
      error: {
        code: 'LEAD_EMPLOYEE_NOT_FOUND',
        message: 'Lead employee not found',
      },
    });
    return;
  }

  if (error instanceof ProjectMemberNotFoundError) {
    response.status(404).json({
      error: {
        code: 'PROJECT_MEMBER_NOT_FOUND',
        message: 'Project member not found',
      },
    });
    return;
  }

  if (error instanceof TaskNotFoundError) {
    response.status(404).json({
      error: { code: 'TASK_NOT_FOUND', message: 'Task not found' },
    });
    return;
  }

  if (error instanceof EmailAlreadyExistsError) {
    response.status(409).json({
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already exists' },
    });
    return;
  }

  if (error instanceof ProjectHasDependenciesError) {
    response.status(409).json({
      error: {
        code: 'PROJECT_HAS_DEPENDENCIES',
        message: 'Project cannot be deleted while it has members or tasks',
      },
    });
    return;
  }

  if (error instanceof ProjectMemberAlreadyExistsError) {
    response.status(409).json({
      error: {
        code: 'PROJECT_MEMBER_ALREADY_EXISTS',
        message: 'Employee is already a project member',
      },
    });
    return;
  }

  if (error instanceof ProjectLeadCannotBeRemovedError) {
    response.status(409).json({
      error: {
        code: 'PROJECT_LEAD_CANNOT_BE_REMOVED',
        message: 'Project lead cannot be removed from project members',
      },
    });
    return;
  }

  if (error instanceof ProjectMemberHasActiveTasksError) {
    response.status(409).json({
      error: {
        code: 'PROJECT_MEMBER_HAS_ACTIVE_TASKS',
        message: 'Project member still has active tasks',
      },
    });
    return;
  }

  console.error(
    'Unhandled request error:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  response.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
  });
};

function isMalformedJsonError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as SyntaxError & { status?: number }).status === 400
  );
}
