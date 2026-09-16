import { jwtVerify, SignJWT } from 'jose';

import type { JwtConfig } from '../../config/jwt.js';
import { UnauthorizedError } from './auth.errors.js';
import type {
  AuthenticatedIdentity,
  TokenService,
} from './auth.types.js';

const POSITIVE_INTEGER = /^[1-9]\d*$/;

export function createTokenService(config: JwtConfig): TokenService {
  const secretKey = new TextEncoder().encode(config.secret);

  return {
    expiresIn: config.accessTokenTtlSeconds,

    async sign(identity: AuthenticatedIdentity): Promise<string> {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(identity.userId)
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt()
        .setExpirationTime(
          Math.floor(Date.now() / 1000) + config.accessTokenTtlSeconds,
        )
        .sign(secretKey);
    },

    async verify(token: string): Promise<AuthenticatedIdentity> {
      try {
        const { payload } = await jwtVerify(token, secretKey, {
          algorithms: ['HS256'],
          issuer: config.issuer,
          audience: config.audience,
        });

        if (
          typeof payload.sub !== 'string' ||
          !POSITIVE_INTEGER.test(payload.sub)
        ) {
          throw new UnauthorizedError();
        }

        return { userId: payload.sub };
      } catch {
        throw new UnauthorizedError();
      }
    },
  };
}
