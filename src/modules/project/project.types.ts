import type { EmployeeResponse } from '../employee/employee.types.js';
import type { Pagination } from '../../http/pagination.js';

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
  findAll(pagination: Pagination): Promise<ProjectResponse[]>;
  findAllAccessibleByUserId(
    userId: string,
    pagination: Pagination,
  ): Promise<ProjectResponse[]>;
  findById(projectId: string): Promise<ProjectResponse | null>;
  findAccessibleById(
    userId: string,
    projectId: string,
  ): Promise<ProjectResponse | null>;
  update(
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectResponse | null | 'LEAD_NOT_FOUND'>;
  delete(projectId: string): Promise<boolean>;
}
