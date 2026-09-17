import { EmployeeNotFoundError, ForbiddenError } from '../employee/employee.errors.js';
import {
  DEFAULT_PAGINATION,
  type Pagination,
} from '../../http/pagination.js';
import type { EmployeeRepository } from '../employee/employee.types.js';
import type { EmployeeRole } from '../employee/employee.types.js';
import { ProjectNotFoundError } from '../project/project.errors.js';
import {
  AssigneeNotProjectMemberError,
  InvalidTaskStatusTransitionError,
  TaskNotFoundError,
} from './task.errors.js';
import type {
  CreateTaskInput,
  TaskRepository,
  TaskResponse,
  UpdateTaskInput,
  TaskStatus,
} from './task.types.js';

type RoleRepository = Pick<EmployeeRepository, 'findActorRoleByUserId'>;

export interface TaskService {
  create(
    actorUserId: string,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskResponse>;
  findAllByProjectId(
    actorUserId: string,
    projectId: string,
    pagination?: Pagination,
  ): Promise<TaskResponse[]>;
  findById(actorUserId: string, taskId: string): Promise<TaskResponse>;
  update(
    actorUserId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskResponse>;
  updateStatus(
    actorUserId: string,
    taskId: string,
    status: TaskStatus,
  ): Promise<TaskResponse>;
  delete(actorUserId: string, taskId: string): Promise<void>;
}

export function createTaskService(
  repository: TaskRepository,
  roleRepository: RoleRepository,
): TaskService {
  async function projectAccess(actorUserId: string, projectId: string) {
    const access = await repository.findProjectAccess(actorUserId, projectId);
    if (!access.projectExists) throw new ProjectNotFoundError();
    return access;
  }

  async function assertCanLeadOrAdmin(
    actorUserId: string,
    projectId: string,
    knownRole?: EmployeeRole,
  ): Promise<void> {
    const role = knownRole ?? await roleRepository.findActorRoleByUserId(actorUserId);
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return;
    if (!role) throw new ForbiddenError();
    const access = await projectAccess(actorUserId, projectId);
    if (!access.isLead) throw new ForbiddenError();
  }

  return {
    async create(actorUserId, projectId, input) {
      await assertCanLeadOrAdmin(actorUserId, projectId);
      const result = await repository.create(projectId, input);
      if (result.status === 'project-not-found') throw new ProjectNotFoundError();
      if (result.status === 'employee-not-found') throw new EmployeeNotFoundError();
      if (result.status === 'assignee-not-project-member') {
        throw new AssigneeNotProjectMemberError();
      }
      return result.task;
    },

    async findAllByProjectId(
      actorUserId,
      projectId,
      pagination = DEFAULT_PAGINATION,
    ) {
      const role = await roleRepository.findActorRoleByUserId(actorUserId);
      if (!role) throw new ForbiddenError();
      let assignedEmployeeId: string | undefined;
      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        const access = await projectAccess(actorUserId, projectId);
        if (!access.isLead && !access.isMember) throw new ForbiddenError();
        if (!access.isLead) {
          if (!access.actorEmployeeId) throw new ForbiddenError();
          assignedEmployeeId = access.actorEmployeeId;
        }
      }
      const result = await repository.findAllByProjectId(
        projectId,
        pagination,
        assignedEmployeeId,
      );
      if (result.status === 'project-not-found') throw new ProjectNotFoundError();
      return result.tasks;
    },

    async findById(actorUserId, taskId) {
      const role = await roleRepository.findActorRoleByUserId(actorUserId);
      if (!role) throw new ForbiddenError();
      const task = await repository.findById(taskId);
      if (!task) throw new TaskNotFoundError();
      if (
        role !== 'ADMIN' &&
        role !== 'SUPER_ADMIN' &&
        task.assignee.userId !== actorUserId
      ) {
        const access = await projectAccess(actorUserId, task.project.projectId);
        if (!access.isLead) throw new ForbiddenError();
      }
      return task;
    },

    async update(actorUserId, taskId, input) {
      const role = await roleRepository.findActorRoleByUserId(actorUserId);
      if (!role) throw new ForbiddenError();
      const existing = await repository.findById(taskId);
      if (!existing) throw new TaskNotFoundError();
      await assertCanLeadOrAdmin(actorUserId, existing.project.projectId, role);
      const result = await repository.update(taskId, input);
      if (result.status === 'task-not-found') throw new TaskNotFoundError();
      if (result.status === 'employee-not-found') throw new EmployeeNotFoundError();
      if (result.status === 'assignee-not-project-member') {
        throw new AssigneeNotProjectMemberError();
      }
      return result.task;
    },

    async updateStatus(actorUserId, taskId, status) {
      const actorRole = await roleRepository.findActorRoleByUserId(actorUserId);
      if (!actorRole) throw new ForbiddenError();
      const result = await repository.updateStatus(actorUserId, taskId, status);
      if (result.status === 'task-not-found') throw new TaskNotFoundError();
      if (result.status === 'actor-not-employee' || result.status === 'forbidden') {
        throw new ForbiddenError();
      }
      if (result.status === 'invalid-transition') {
        throw new InvalidTaskStatusTransitionError();
      }
      return result.task;
    },

    async delete(actorUserId, taskId) {
      const role = await roleRepository.findActorRoleByUserId(actorUserId);
      if (!role) throw new ForbiddenError();
      const existing = await repository.findById(taskId);
      if (!existing) throw new TaskNotFoundError();
      await assertCanLeadOrAdmin(actorUserId, existing.project.projectId, role);
      if (!await repository.delete(taskId)) throw new TaskNotFoundError();
    },
  };
}
