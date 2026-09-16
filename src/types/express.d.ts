import type { AuthenticatedIdentity } from '../modules/auth/auth.types.js';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '../modules/employee/employee.types.js';

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
    }
  }
}

export {};
