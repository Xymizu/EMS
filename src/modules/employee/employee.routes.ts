import { Router, type RequestHandler } from 'express';

import type { EmployeeController } from './employee.controller.js';
import {
  validateCreateEmployee,
  validateEmployeeId,
  validateUpdateEmployee,
} from './employee.validator.js';

const validateCreate: RequestHandler = (request, _response, next) => {
  try {
    request.validatedEmployeeCreate = validateCreateEmployee(request.body);
    next();
  } catch (error: unknown) {
    next(error);
  }
};

const validateId: RequestHandler = (request, _response, next) => {
  try {
    const value = request.params.employeeId;
    request.validatedEmployeeId = validateEmployeeId(
      typeof value === 'string' ? value : '',
    );
    next();
  } catch (error: unknown) {
    next(error);
  }
};

const validateUpdate: RequestHandler = (request, _response, next) => {
  try {
    request.validatedEmployeeUpdate = validateUpdateEmployee(request.body);
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export function createEmployeeRouter(
  controller: EmployeeController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.post('/', authenticate, validateCreate, controller.create);
  router.get('/', authenticate, controller.findAll);
  router.get('/:employeeId', authenticate, validateId, controller.findById);
  router.patch(
    '/:employeeId',
    authenticate,
    validateId,
    validateUpdate,
    controller.update,
  );
  return router;
}
