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

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function databasePort(): number {
  const value = Number(process.env.DB_PORT ?? '3306');
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }
  return value;
}

export function getServerConfig(): ConnectionOptions {
  const password =
    process.env.DB_PASSWORD_IS_EMPTY === 'true'
      ? ''
      : (process.env.DB_PASSWORD ?? '');

  return {
    host: requiredEnvironmentVariable('DB_HOST'),
    port: databasePort(),
    user: requiredEnvironmentVariable('DB_USER'),
    password,
    charset: 'utf8mb4',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}

export function getDatabaseName(useTestDatabase = false): string {
  return requiredEnvironmentVariable(useTestDatabase ? 'TEST_DB_NAME' : 'DB_NAME');
}

export function getDatabaseConfig(useTestDatabase = false): ConnectionOptions {
  return {
    ...getServerConfig(),
    database: getDatabaseName(useTestDatabase),
  };
}
