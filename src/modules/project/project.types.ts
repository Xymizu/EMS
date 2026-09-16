import type { EmployeeResponse } from '../employee/employee.types.js';

export interface ProjectResponse {
  projectId: string;
  namaProject: string;
  lead: EmployeeResponse;
}

export interface CreateProjectInput {
  namaProject: string;
  leadEmployeeId: string;
}

export interface UpdateProjectInput {
  namaProject?: string;
  leadEmployeeId?: string;
}

export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<ProjectResponse | null>;
  findAll(): Promise<ProjectResponse[]>;
  findById(projectId: string): Promise<ProjectResponse | null>;
  update(
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectResponse | null | 'LEAD_NOT_FOUND'>;
  delete(projectId: string): Promise<boolean>;
}
