import express, { type Express } from 'express';
import type { Pool } from 'mysql2/promise';

import { parseJwtConfig, type JwtConfig } from './config/jwt.js';
import { getApplicationPool } from './database/pool.js';
import { createAuthenticateMiddleware } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import {
  createRateLimitMiddleware,
  securityHeaders,
  type RateLimitOptions,
} from './middleware/security.js';
import { requestLogger } from './middleware/request-logger.js';
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
import { createProjectController } from './modules/project/project.controller.js';
import { createProjectRepository } from './modules/project/project.repository.js';
import { createProjectRouter } from './modules/project/project.routes.js';
import { createProjectService } from './modules/project/project.service.js';
import { createProjectMemberController } from './modules/project-member/project-member.controller.js';
import { createProjectMemberRepository } from './modules/project-member/project-member.repository.js';
import { createProjectMemberRouter } from './modules/project-member/project-member.routes.js';
import { createProjectMemberService } from './modules/project-member/project-member.service.js';
import { createTaskController } from './modules/task/task.controller.js';
import { createTaskRepository } from './modules/task/task.repository.js';
import {
  createProjectTaskRouter,
  createTaskRouter,
} from './modules/task/task.routes.js';
import { createTaskService } from './modules/task/task.service.js';

export interface ApplicationOptions {
  pool?: Pool;
  jwtConfig?: JwtConfig;
  passwordHashRounds?: number;
  authRateLimit?: RateLimitOptions | false;
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
  const employeeRepository = createEmployeeRepository(pool);
  const employeeService = createEmployeeService(employeeRepository, passwordService);
  const employeeController = createEmployeeController(employeeService);
  const projectService = createProjectService(
    createProjectRepository(pool),
    employeeRepository,
  );
  const projectController = createProjectController(projectService);
  const projectMemberService = createProjectMemberService(
    createProjectMemberRepository(pool),
    employeeRepository,
  );
  const projectMemberController = createProjectMemberController(
    projectMemberService,
  );
  const taskService = createTaskService(
    createTaskRepository(pool),
    employeeRepository,
  );
  const taskController = createTaskController(taskService);
  const authenticate = createAuthenticateMiddleware(tokenService);
  const authRateLimit = options.authRateLimit === false
    ? undefined
    : createRateLimitMiddleware(options.authRateLimit ?? {
        windowMs: 60_000,
        maxRequests: 10,
      });

  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.use(securityHeaders);
  if (process.env.NODE_ENV === 'production') app.use(requestLogger);
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', async (_request, response) => {
    try {
      await pool.query('SELECT 1');
      response.status(200).json({ data: { status: 'ok' } });
    } catch {
      response.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' },
      });
    }
  });
  app.use(
    '/auth',
    createAuthRouter(
      controller,
      authenticate,
      authRateLimit,
    ),
  );
  app.use(
    '/employees',
    createEmployeeRouter(employeeController, authenticate),
  );
  app.use(
    '/projects',
    createProjectRouter(projectController, authenticate),
  );
  app.use(
    '/projects',
    createProjectMemberRouter(projectMemberController, authenticate),
  );
  app.use(
    '/projects',
    createProjectTaskRouter(taskController, authenticate),
  );
  app.use('/tasks', createTaskRouter(taskController, authenticate));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
