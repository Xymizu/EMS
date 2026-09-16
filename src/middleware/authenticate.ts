import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { TokenService } from '../modules/auth/auth.types.js';

const BEARER_CREDENTIAL = /^Bearer ([^\s,]+)$/i;

const unauthorizedBody = {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
  },
} as const;

export function createAuthenticateMiddleware(
  tokenService: TokenService,
): RequestHandler {
  return async function authenticate(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const authorization = request.get('authorization');
    const match = authorization?.match(BEARER_CREDENTIAL);
    if (!match?.[1]) {
      response.status(401).json(unauthorizedBody);
      return;
    }

    try {
      request.auth = await tokenService.verify(match[1]);
      next();
    } catch {
      response.status(401).json(unauthorizedBody);
    }
  };
}
