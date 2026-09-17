import { EmployeeNotFoundError, ForbiddenError } from '../employee/employee.errors.js';
import {
  DEFAULT_PAGINATION,
  type Pagination,
} from '../../http/pagination.js';
import type { EmployeeRepository, EmployeeResponse } from '../employee/employee.types.js';
import { ProjectNotFoundError } from '../project/project.errors.js';
import {
  ProjectLeadCannotBeRemovedError,
  ProjectMemberAlreadyExistsError,
  ProjectMemberHasTasksError,
  ProjectMemberNotFoundError,
} from './project-member.errors.js';
import type { ProjectMemberRepository } from './project-member.types.js';

type RoleRepository = Pick<EmployeeRepository, 'findActorRoleByUserId'>;

export interface ProjectMemberService {
  findAll(
    actorUserId: string,
    projectId: string,
    pagination?: Pagination,
  ): Promise<EmployeeResponse[]>;
  add(
    actorUserId: string,
    projectId: string,
    employeeId: string,
  ): Promise<EmployeeResponse>;
  remove(
    actorUserId: string,
    projectId: string,
    employeeId: string,
  ): Promise<void>;
}

export function createProjectMemberService(
  repository: ProjectMemberRepository,
  roleRepository: RoleRepository,
): ProjectMemberService {
  async function assertCanManageMembers(actorUserId: string): Promise<void> {
    const role = await roleRepository.findActorRoleByUserId(actorUserId);
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') throw new ForbiddenError();
  }

  return {
    async findAll(actorUserId, projectId, pagination = DEFAULT_PAGINATION) {
      await assertCanManageMembers(actorUserId);
      const result = await repository.findAll(projectId, pagination);
      if (result.status === 'project-not-found') throw new ProjectNotFoundError();
      return result.members;
    },

    async add(actorUserId, projectId, employeeId) {
      await assertCanManageMembers(actorUserId);
      const result = await repository.add(projectId, employeeId);
      if (result.status === 'project-not-found') throw new ProjectNotFoundError();
      if (result.status === 'employee-not-found') throw new EmployeeNotFoundError();
      if (result.status === 'already-exists') {
        throw new ProjectMemberAlreadyExistsError();
      }
      return result.member;
    },

    async remove(actorUserId, projectId, employeeId) {
      await assertCanManageMembers(actorUserId);
      const result = await repository.remove(projectId, employeeId);
      if (result.status === 'project-not-found') throw new ProjectNotFoundError();
      if (result.status === 'employee-not-found') throw new EmployeeNotFoundError();
      if (result.status === 'member-not-found') throw new ProjectMemberNotFoundError();
      if (result.status === 'lead-cannot-be-removed') {
        throw new ProjectLeadCannotBeRemovedError();
      }
      if (result.status === 'has-tasks') {
        throw new ProjectMemberHasTasksError();
      }
    },
  };
}
