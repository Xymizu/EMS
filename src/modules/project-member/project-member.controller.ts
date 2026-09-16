import type { RequestHandler } from 'express';

import { UnauthorizedError } from '../auth/auth.errors.js';
import type { ProjectMemberService } from './project-member.service.js';

function identity(request: Express.Request): string {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth.userId;
}

export interface ProjectMemberController {
  findAll: RequestHandler;
  add: RequestHandler;
  remove: RequestHandler;
}

export function createProjectMemberController(
  service: ProjectMemberService,
): ProjectMemberController {
  return {
    async findAll(request, response) {
      if (!request.validatedProjectId) throw new Error('Project ID missing');
      const members = await service.findAll(
        identity(request),
        request.validatedProjectId,
      );
      response.status(200).json({
        data: { projectId: request.validatedProjectId, members },
      });
    },

    async add(request, response) {
      if (!request.validatedProjectId || !request.validatedProjectMemberAdd) {
        throw new Error('Project member input missing');
      }
      const member = await service.add(
        identity(request),
        request.validatedProjectId,
        request.validatedProjectMemberAdd.employeeId,
      );
      response.status(201).json({
        data: { projectId: request.validatedProjectId, member },
      });
    },

    async remove(request, response) {
      if (!request.validatedProjectId || !request.validatedMemberEmployeeId) {
        throw new Error('Project member IDs missing');
      }
      await service.remove(
        identity(request),
        request.validatedProjectId,
        request.validatedMemberEmployeeId,
      );
      response.status(204).send();
    },
  };
}
