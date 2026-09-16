import type { RequestHandler } from 'express';

import { UnauthorizedError } from '../auth/auth.errors.js';
import type { ProjectService } from './project.service.js';

function identity(request: Express.Request): string {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth.userId;
}

export interface ProjectController {
  create: RequestHandler;
  findAll: RequestHandler;
  findById: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

export function createProjectController(service: ProjectService): ProjectController {
  return {
    async create(request, response) {
      if (!request.validatedProjectCreate) throw new Error('Create input missing');
      const project = await service.create(
        identity(request),
        request.validatedProjectCreate,
      );
      response.status(201).json({ data: { project } });
    },

    async findAll(request, response) {
      const projects = await service.findAll(identity(request));
      response.status(200).json({ data: { projects } });
    },

    async findById(request, response) {
      if (!request.validatedProjectId) throw new Error('Project ID missing');
      const project = await service.findById(
        identity(request),
        request.validatedProjectId,
      );
      response.status(200).json({ data: { project } });
    },

    async update(request, response) {
      if (!request.validatedProjectId || !request.validatedProjectUpdate) {
        throw new Error('Project update input missing');
      }
      const project = await service.update(
        identity(request),
        request.validatedProjectId,
        request.validatedProjectUpdate,
      );
      response.status(200).json({ data: { project } });
    },

    async delete(request, response) {
      if (!request.validatedProjectId) throw new Error('Project ID missing');
      await service.delete(identity(request), request.validatedProjectId);
      response.status(204).send();
    },
  };
}
