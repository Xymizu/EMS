import { ForbiddenError } from '../employee/employee.errors.js';
import type { EmployeeRepository } from '../employee/employee.types.js';
import {
  LeadEmployeeNotFoundError,
  ProjectNotFoundError,
} from './project.errors.js';
import type {
  CreateProjectInput,
  ProjectRepository,
  ProjectResponse,
  UpdateProjectInput,
} from './project.types.js';

type RoleRepository = Pick<EmployeeRepository, 'findActorRoleByUserId'>;

export interface ProjectService {
  create(actorUserId: string, input: CreateProjectInput): Promise<ProjectResponse>;
  findAll(actorUserId: string): Promise<ProjectResponse[]>;
  findById(actorUserId: string, projectId: string): Promise<ProjectResponse>;
  update(
    actorUserId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectResponse>;
  delete(actorUserId: string, projectId: string): Promise<void>;
}

export function createProjectService(
  repository: ProjectRepository,
  roleRepository: RoleRepository,
): ProjectService {
  async function assertCanManageProjects(actorUserId: string): Promise<void> {
    const role = await roleRepository.findActorRoleByUserId(actorUserId);
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') throw new ForbiddenError();
  }

  return {
    async create(actorUserId, input) {
      await assertCanManageProjects(actorUserId);
      const project = await repository.create(input);
      if (!project) throw new LeadEmployeeNotFoundError();
      return project;
    },

    async findAll(actorUserId) {
      await assertCanManageProjects(actorUserId);
      return repository.findAll();
    },

    async findById(actorUserId, projectId) {
      await assertCanManageProjects(actorUserId);
      const project = await repository.findById(projectId);
      if (!project) throw new ProjectNotFoundError();
      return project;
    },

    async update(actorUserId, projectId, input) {
      await assertCanManageProjects(actorUserId);
      const project = await repository.update(projectId, input);
      if (project === 'LEAD_NOT_FOUND') throw new LeadEmployeeNotFoundError();
      if (!project) throw new ProjectNotFoundError();
      return project;
    },

    async delete(actorUserId, projectId) {
      await assertCanManageProjects(actorUserId);
      if (!await repository.delete(projectId)) throw new ProjectNotFoundError();
    },
  };
}
