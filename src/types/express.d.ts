import type { AuthenticatedIdentity } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedIdentity;
      validatedLogin?: {
        email: string;
        password: string;
      };
    }
  }
}

export {};
