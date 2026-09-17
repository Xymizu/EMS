import { Router, type RequestHandler } from 'express';

import type { ProjectController } from './project.controller.js';
import { validatePagination } from '../../http/pagination.js';
import {
  validateCreateProject,
  validateProjectId,
  validateUpdateProject,
} from './project.validator.js';

const validateCreate: RequestHandler = (request, _response, next) => {
  try {
    request.validatedProjectCreate = validateCreateProject(request.body);
    next();
  } catch (error: unknown) { next(error); }
};

const validateId: RequestHandler = (request, _response, next) => {
  try {
    const value = request.params.projectId;
    request.validatedProjectId = validateProjectId(
      typeof value === 'string' ? value : '',
    );
    next();
  } catch (error: unknown) { next(error); }
};

const validateUpdate: RequestHandler = (request, _response, next) => {
  try {
    request.validatedProjectUpdate = validateUpdateProject(request.body);
    next();
  } catch (error: unknown) { next(error); }
};

const validatePage: RequestHandler = (request, _response, next) => {
  try {
    request.validatedPagination = validatePagination(request.query);
    next();
  } catch (error: unknown) { next(error); }
};

export function createProjectRouter(
  controller: ProjectController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.post('/', authenticate, validateCreate, controller.create);
  router.get('/', authenticate, validatePage, controller.findAll);
  router.get('/:projectId', authenticate, validateId, controller.findById);
  router.patch(
    '/:projectId',
    authenticate,
    validateId,
    validateUpdate,
    controller.update,
  );
  router.delete('/:projectId', authenticate, validateId, controller.delete);
  return router;
}
