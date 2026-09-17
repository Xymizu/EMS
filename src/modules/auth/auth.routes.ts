import { Router, type RequestHandler } from 'express';

import type { AuthController } from './auth.controller.js';
import { validateLoginInput } from './auth.validator.js';

const validateLogin: RequestHandler = (request, _response, next) => {
  try {
    request.validatedLogin = validateLoginInput(request.body);
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export function createAuthRouter(
  controller: AuthController,
  authenticate: RequestHandler,
  rateLimit?: RequestHandler,
): Router {
  const router = Router();

  router.post('/login', ...(rateLimit ? [rateLimit] : []), validateLogin, controller.login);
  router.get('/me', authenticate, controller.currentUser);
  router.post('/logout', authenticate, controller.logout);

  return router;
}
