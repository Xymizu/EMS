import { Router, type RequestHandler } from 'express';

import type { ProjectMemberController } from './project-member.controller.js';
import {
  validateAddProjectMember,
  validateEmployeeId,
  validateProjectId,
} from './project-member.validator.js';

const validateProject: RequestHandler = (request, _response, next) => {
  try {
    const value = request.params.projectId;
    request.validatedProjectId = validateProjectId(
      typeof value === 'string' ? value : '',
    );
    next();
  } catch (error: unknown) { next(error); }
};

const validateAdd: RequestHandler = (request, _response, next) => {
  try {
    request.validatedProjectMemberAdd = validateAddProjectMember(request.body);
    next();
  } catch (error: unknown) { next(error); }
};

const validateEmployee: RequestHandler = (request, _response, next) => {
  try {
    const value = request.params.employeeId;
    request.validatedMemberEmployeeId = validateEmployeeId(
      typeof value === 'string' ? value : '',
    );
    next();
  } catch (error: unknown) { next(error); }
};

export function createProjectMemberRouter(
  controller: ProjectMemberController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.get(
    '/:projectId/members',
    authenticate,
    validateProject,
    controller.findAll,
  );
  router.post(
    '/:projectId/members',
    authenticate,
    validateProject,
    validateAdd,
    controller.add,
  );
  router.delete(
    '/:projectId/members/:employeeId',
    authenticate,
    validateProject,
    validateEmployee,
    controller.remove,
  );
  return router;
}
