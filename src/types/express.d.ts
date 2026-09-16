import type { AuthenticatedIdentity } from '../modules/auth/auth.types.js';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '../modules/employee/employee.types.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from '../modules/project/project.types.js';
import type { AddProjectMemberInput } from '../modules/project-member/project-member.types.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from '../modules/task/task.types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedIdentity;
      validatedLogin?: {
        email: string;
        password: string;
      };
      validatedEmployeeCreate?: CreateEmployeeInput;
      validatedEmployeeUpdate?: UpdateEmployeeInput;
      validatedEmployeeId?: string;
      validatedProjectCreate?: CreateProjectInput;
      validatedProjectUpdate?: UpdateProjectInput;
      validatedProjectId?: string;
      validatedProjectMemberAdd?: AddProjectMemberInput;
      validatedMemberEmployeeId?: string;
      validatedTaskId?: string;
      validatedTaskCreate?: CreateTaskInput;
      validatedTaskUpdate?: UpdateTaskInput;
    }
  }
}

export {};
