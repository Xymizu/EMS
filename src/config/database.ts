import { loadEnvFile } from 'node:process';

import type { ConnectionOptions } from 'mysql2/promise';

try {
  loadEnvFile('.env');
} catch (error: unknown) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') {
    throw error;
  }
}

function requiredEnvironmentVariable(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function databasePort(environment: NodeJS.ProcessEnv): number {
  const value = Number(environment.DB_PORT ?? '3306');
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }
  return value;
}

export function getServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ConnectionOptions {
  const allowEmptyPassword = environment.DB_PASSWORD_IS_EMPTY === 'true';
  if (allowEmptyPassword && environment.NODE_ENV === 'production') {
    throw new Error('Empty database passwords are forbidden in production');
  }
  const password = allowEmptyPassword
    ? ''
    : requiredEnvironmentVariable(environment, 'DB_PASSWORD');
  const user = requiredEnvironmentVariable(environment, 'DB_USER');
  if (environment.NODE_ENV === 'production' && user.toLowerCase() === 'root') {
    throw new Error('The application database user must not be root in production');
  }

  return {
    host: requiredEnvironmentVariable(environment, 'DB_HOST'),
    port: databasePort(environment),
    user,
    password,
    charset: 'utf8mb4',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}

export function getAdminServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ConnectionOptions {
  const applicationConfig = getServerConfig({
    ...environment,
    NODE_ENV: environment.NODE_ENV === 'production' ? 'setup' : environment.NODE_ENV,
  });
  const applicationUser = requiredEnvironmentVariable(environment, 'DB_USER');
  const adminUser = environment.DB_ADMIN_USER?.trim() || applicationUser;
  const adminPassword = environment.DB_ADMIN_PASSWORD ?? String(
    applicationConfig.password ?? '',
  );
  if (environment.NODE_ENV === 'production' && !adminPassword) {
    throw new Error('DB_ADMIN_PASSWORD is required in production');
  }
  return {
    ...applicationConfig,
    user: adminUser,
    password: adminPassword,
  };
}

export function getDatabaseName(
  useTestDatabase = false,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return requiredEnvironmentVariable(
    environment,
    useTestDatabase ? 'TEST_DB_NAME' : 'DB_NAME',
  );
}

export function getDatabaseConfig(
  useTestDatabase = false,
  environment: NodeJS.ProcessEnv = process.env,
): ConnectionOptions {
  return {
    ...getServerConfig(environment),
    database: getDatabaseName(useTestDatabase, environment),
  };
}
