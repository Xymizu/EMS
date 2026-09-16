import type { EmployeeResponse } from '../employee/employee.types.js';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface TaskResponse {
  taskId: string;
  namaTask: string;
  status: TaskStatus;
  project: {
    projectId: string;
    namaProject: string;
  };
  assignee: EmployeeResponse;
}

export interface CreateTaskInput {
  namaTask: string;
  assignedEmployeeId: string;
}

export interface UpdateTaskInput {
  namaTask?: string;
  assignedEmployeeId?: string;
}

export type UpdateTaskStatusResult =
  | { status: 'ok'; task: TaskResponse }
  | { status: 'task-not-found' }
  | { status: 'actor-not-employee' }
  | { status: 'forbidden' }
  | { status: 'invalid-transition' };

export type TaskListResult =
  | { status: 'ok'; tasks: TaskResponse[] }
  | { status: 'project-not-found' };

export type CreateTaskResult =
  | { status: 'ok'; task: TaskResponse }
  | { status: 'project-not-found' }
  | { status: 'employee-not-found' }
  | { status: 'assignee-not-project-member' };

export type UpdateTaskResult =
  | { status: 'ok'; task: TaskResponse }
  | { status: 'task-not-found' }
  | { status: 'employee-not-found' }
  | { status: 'assignee-not-project-member' };

export interface TaskRepository {
  create(projectId: string, input: CreateTaskInput): Promise<CreateTaskResult>;
  findAllByProjectId(projectId: string): Promise<TaskListResult>;
  findById(taskId: string): Promise<TaskResponse | null>;
  update(taskId: string, input: UpdateTaskInput): Promise<UpdateTaskResult>;
  updateStatus(
    actorUserId: string,
    taskId: string,
    targetStatus: TaskStatus,
  ): Promise<UpdateTaskStatusResult>;
  delete(taskId: string): Promise<boolean>;
}
