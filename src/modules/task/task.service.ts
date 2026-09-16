import { EmployeeNotFoundError, ForbiddenError } from '../employee/employee.errors.js';
import type { EmployeeRepository } from '../employee/employee.types.js';
import { ProjectNotFoundError } from '../project/project.errors.js';
import {
  AssigneeNotProjectMemberError,
  TaskNotFoundError,
} from './task.errors.js';
import type {
  CreateTaskInput,
  TaskRepository,
  TaskResponse,
  UpdateTaskInput,
} from './task.types.js';

type RoleRepository = Pick<EmployeeRepository, 'findActorRoleByUserId'>;

export interface TaskService {
  create(
    actorUserId: string,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskResponse>;
  findAllByProjectId(actorUserId: string, projectId: string): Promise<TaskResponse[]>;
  findById(actorUserId: string, taskId: string): Promise<TaskResponse>;
  update(
    actorUserId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskResponse>;
  delete(actorUserId: string, taskId: string): Promise<void>;
}

export function createTaskService(
  repository: TaskRepository,
  roleRepository: RoleRepository,
): TaskService {
  async function assertCanManageTasks(actorUserId: string): Promise<void> {
    const role = await roleRepository.findActorRoleByUserId(actorUserId);
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') throw new ForbiddenError();
  }

  return {
    async create(actorUserId, projectId, input) {
      await assertCanManageTasks(actorUserId);
      const result = await repository.create(projectId, input);
      if (result.status === 'project-not-found') throw new ProjectNotFoundError();
      if (result.status === 'employee-not-found') throw new EmployeeNotFoundError();
      if (result.status === 'assignee-not-project-member') {
        throw new AssigneeNotProjectMemberError();
      }
      return result.task;
    },

    async findAllByProjectId(actorUserId, projectId) {
      await assertCanManageTasks(actorUserId);
      const result = await repository.findAllByProjectId(projectId);
      if (result.status === 'project-not-found') throw new ProjectNotFoundError();
      return result.tasks;
    },

    async findById(actorUserId, taskId) {
      await assertCanManageTasks(actorUserId);
      const task = await repository.findById(taskId);
      if (!task) throw new TaskNotFoundError();
      return task;
    },

    async update(actorUserId, taskId, input) {
      await assertCanManageTasks(actorUserId);
      const result = await repository.update(taskId, input);
      if (result.status === 'task-not-found') throw new TaskNotFoundError();
      if (result.status === 'employee-not-found') throw new EmployeeNotFoundError();
      if (result.status === 'assignee-not-project-member') {
        throw new AssigneeNotProjectMemberError();
      }
      return result.task;
    },

    async delete(actorUserId, taskId) {
      await assertCanManageTasks(actorUserId);
      if (!await repository.delete(taskId)) throw new TaskNotFoundError();
    },
  };
}
