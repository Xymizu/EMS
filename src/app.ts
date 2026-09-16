import express, { type Express } from 'express';
import type { Pool } from 'mysql2/promise';

import { parseJwtConfig, type JwtConfig } from './config/jwt.js';
import { getApplicationPool } from './database/pool.js';
import { createAuthenticateMiddleware } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPasswordService } from './modules/auth/password.service.js';
import { createTokenService } from './modules/auth/token.service.js';
import { createEmployeeController } from './modules/employee/employee.controller.js';
import { createEmployeeRepository } from './modules/employee/employee.repository.js';
import { createEmployeeRouter } from './modules/employee/employee.routes.js';
import { createEmployeeService } from './modules/employee/employee.service.js';

export interface ApplicationOptions {
  pool?: Pool;
  jwtConfig?: JwtConfig;
  passwordHashRounds?: number;
}

export function createApp(options: ApplicationOptions = {}): Express {
  const pool = options.pool ?? getApplicationPool();
  const jwtConfig = options.jwtConfig ?? parseJwtConfig();
  const tokenService = createTokenService(jwtConfig);
  const passwordService = createPasswordService(options.passwordHashRounds ?? 12);
  const repository = createAuthRepository(pool);
  const service = createAuthService(
    repository,
    passwordService,
    tokenService,
  );
  const controller = createAuthController(service);
  const employeeService = createEmployeeService(
    createEmployeeRepository(pool),
    passwordService,
  );
  const employeeController = createEmployeeController(employeeService);
  const authenticate = createAuthenticateMiddleware(tokenService);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(
    '/auth',
    createAuthRouter(
      controller,
      authenticate,
    ),
  );
  app.use(
    '/employees',
    createEmployeeRouter(employeeController, authenticate),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
