import type { EmployeeResponse } from '../employee/employee.types.js';

export interface AddProjectMemberInput {
  employeeId: string;
}

export type ProjectMemberListResult =
  | { status: 'ok'; members: EmployeeResponse[] }
  | { status: 'project-not-found' };

export type AddProjectMemberResult =
  | { status: 'ok'; member: EmployeeResponse }
  | { status: 'project-not-found' }
  | { status: 'employee-not-found' }
  | { status: 'already-exists' };

export type RemoveProjectMemberResult =
  | { status: 'ok' }
  | { status: 'project-not-found' }
  | { status: 'employee-not-found' }
  | { status: 'member-not-found' }
  | { status: 'lead-cannot-be-removed' }
  | { status: 'has-active-tasks' };

export interface ProjectMemberRepository {
  findAll(projectId: string): Promise<ProjectMemberListResult>;
  add(projectId: string, employeeId: string): Promise<AddProjectMemberResult>;
  remove(
    projectId: string,
    employeeId: string,
  ): Promise<RemoveProjectMemberResult>;
}
