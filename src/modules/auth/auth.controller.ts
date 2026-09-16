import type { RequestHandler } from 'express';

import { UnauthorizedError } from './auth.errors.js';
import type { AuthService } from './auth.service.js';

export interface AuthController {
  login: RequestHandler;
  currentUser: RequestHandler;
  logout: RequestHandler;
}

export function createAuthController(service: AuthService): AuthController {
  return {
    async login(request, response): Promise<void> {
      if (!request.validatedLogin) {
        throw new Error('Validated login input is missing');
      }
      const credentials = await service.login(request.validatedLogin);
      response.status(200).json({ data: credentials });
    },

    async currentUser(request, response): Promise<void> {
      if (!request.auth) {
        throw new UnauthorizedError();
      }
      const user = await service.getCurrentUser(request.auth.userId);
      response.status(200).json({ data: { user } });
    },

    logout(_request, response): void {
      response.status(200).json({ data: { message: 'Logout successful' } });
    },
  };
}
