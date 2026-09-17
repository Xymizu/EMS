import { Router, type RequestHandler } from 'express';

import type { TaskController } from './task.controller.js';
import { validatePagination } from '../../http/pagination.js';
import {
  validateCreateTask,
  validateProjectId,
  validateTaskId,
  validateTaskStatusUpdate,
  validateUpdateTask,
} from './task.validator.js';

const validateProject: RequestHandler = (request, _response, next) => {
  try {
    const value = request.params.projectId;
    request.validatedProjectId = validateProjectId(
      typeof value === 'string' ? value : '',
    );
    next();
  } catch (error: unknown) { next(error); }
};

const validateId: RequestHandler = (request, _response, next) => {
  try {
    const value = request.params.taskId;
    request.validatedTaskId = validateTaskId(typeof value === 'string' ? value : '');
    next();
  } catch (error: unknown) { next(error); }
};

const validateCreate: RequestHandler = (request, _response, next) => {
  try {
    request.validatedTaskCreate = validateCreateTask(request.body);
    next();
  } catch (error: unknown) { next(error); }
};

const validateUpdate: RequestHandler = (request, _response, next) => {
  try {
    request.validatedTaskUpdate = validateUpdateTask(request.body);
    next();
  } catch (error: unknown) { next(error); }
};

const validateStatusUpdate: RequestHandler = (request, _response, next) => {
  try {
    request.validatedTaskStatus = validateTaskStatusUpdate(request.body);
    next();
  } catch (error: unknown) { next(error); }
};

const validatePage: RequestHandler = (request, _response, next) => {
  try {
    request.validatedPagination = validatePagination(request.query);
    next();
  } catch (error: unknown) { next(error); }
};

export function createProjectTaskRouter(
  controller: TaskController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.post(
    '/:projectId/tasks',
    authenticate,
    validateProject,
    validateCreate,
    controller.create,
  );
  router.get(
    '/:projectId/tasks',
    authenticate,
    validateProject,
    validatePage,
    controller.findAllByProjectId,
  );
  return router;
}

export function createTaskRouter(
  controller: TaskController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.get('/:taskId', authenticate, validateId, controller.findById);
  router.patch(
    '/:taskId/status',
    authenticate,
    validateId,
    validateStatusUpdate,
    controller.updateStatus,
  );
  router.patch(
    '/:taskId',
    authenticate,
    validateId,
    validateUpdate,
    controller.update,
  );
  router.delete('/:taskId', authenticate, validateId, controller.delete);
  return router;
}
