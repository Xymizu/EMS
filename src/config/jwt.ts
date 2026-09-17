import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env');
} catch (error: unknown) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') {
    throw error;
  }
}

export interface JwtConfig {
  secret: string;
  accessTokenTtlSeconds: number;
  issuer: string;
  audience: string;
}

function requiredValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

export function parseJwtConfig(
  environment: NodeJS.ProcessEnv = process.env,
): JwtConfig {
  const secret = requiredValue(environment, 'JWT_SECRET');
  if (
    Buffer.byteLength(secret, 'utf8') < 32 ||
    secret === 'replace_with_at_least_32_random_characters'
  ) {
    throw new Error('JWT_SECRET must contain at least 32 random bytes');
  }

  const accessTokenTtlSeconds = Number(
    requiredValue(environment, 'JWT_ACCESS_TOKEN_TTL_SECONDS'),
  );
  if (!Number.isInteger(accessTokenTtlSeconds) || accessTokenTtlSeconds <= 0) {
    throw new Error('JWT_ACCESS_TOKEN_TTL_SECONDS must be a positive integer');
  }

  return {
    secret,
    accessTokenTtlSeconds,
    issuer: requiredValue(environment, 'JWT_ISSUER'),
    audience: requiredValue(environment, 'JWT_AUDIENCE'),
  };
}

export function parseHttpPort(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const port = Number(environment.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}
