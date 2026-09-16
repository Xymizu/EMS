import type { RequestHandler } from 'express';

import { UnauthorizedError } from '../auth/auth.errors.js';
import type { TaskService } from './task.service.js';

function identity(request: Express.Request): string {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth.userId;
}

export interface TaskController {
  create: RequestHandler;
  findAllByProjectId: RequestHandler;
  findById: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

export function createTaskController(service: TaskService): TaskController {
  return {
    async create(request, response) {
      if (!request.validatedProjectId || !request.validatedTaskCreate) {
        throw new Error('Create task input missing');
      }
      const task = await service.create(
        identity(request),
        request.validatedProjectId,
        request.validatedTaskCreate,
      );
      response.status(201).json({ data: { task } });
    },

    async findAllByProjectId(request, response) {
      if (!request.validatedProjectId) throw new Error('Project ID missing');
      const tasks = await service.findAllByProjectId(
        identity(request),
        request.validatedProjectId,
      );
      response.status(200).json({
        data: { projectId: request.validatedProjectId, tasks },
      });
    },

    async findById(request, response) {
      if (!request.validatedTaskId) throw new Error('Task ID missing');
      const task = await service.findById(identity(request), request.validatedTaskId);
      response.status(200).json({ data: { task } });
    },

    async update(request, response) {
      if (!request.validatedTaskId || !request.validatedTaskUpdate) {
        throw new Error('Update task input missing');
      }
      const task = await service.update(
        identity(request),
        request.validatedTaskId,
        request.validatedTaskUpdate,
      );
      response.status(200).json({ data: { task } });
    },

    async delete(request, response) {
      if (!request.validatedTaskId) throw new Error('Task ID missing');
      await service.delete(identity(request), request.validatedTaskId);
      response.status(204).send();
    },
  };
}
