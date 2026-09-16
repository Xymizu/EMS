import type { RequestHandler } from 'express';

import { UnauthorizedError } from '../auth/auth.errors.js';
import type { EmployeeService } from './employee.service.js';

function identity(request: Express.Request): string {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth.userId;
}

export interface EmployeeController {
  create: RequestHandler;
  findAll: RequestHandler;
  findById: RequestHandler;
  update: RequestHandler;
}

export function createEmployeeController(
  service: EmployeeService,
): EmployeeController {
  return {
    async create(request, response) {
      if (!request.validatedEmployeeCreate) throw new Error('Create input missing');
      const employee = await service.create(
        identity(request),
        request.validatedEmployeeCreate,
      );
      response.status(201).json({ data: { employee } });
    },

    async findAll(request, response) {
      const employees = await service.findAll(identity(request));
      response.status(200).json({ data: { employees } });
    },

    async findById(request, response) {
      if (!request.validatedEmployeeId) throw new Error('Employee ID missing');
      const employee = await service.findById(
        identity(request),
        request.validatedEmployeeId,
      );
      response.status(200).json({ data: { employee } });
    },

    async update(request, response) {
      if (!request.validatedEmployeeId || !request.validatedEmployeeUpdate) {
        throw new Error('Employee update input missing');
      }
      const employee = await service.update(
        identity(request),
        request.validatedEmployeeId,
        request.validatedEmployeeUpdate,
      );
      response.status(200).json({ data: { employee } });
    },
  };
}
