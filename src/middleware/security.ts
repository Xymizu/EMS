import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export const securityHeaders: RequestHandler = (request, response, next) => {
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  if (request.secure || process.env.NODE_ENV === 'production') {
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  next();
};

export function createRateLimitMiddleware(
  options: RateLimitOptions,
): RequestHandler {
  if (!Number.isInteger(options.maxRequests) || options.maxRequests < 1) {
    throw new Error('Rate limit maxRequests must be a positive integer');
  }
  if (!Number.isInteger(options.windowMs) || options.windowMs < 1) {
    throw new Error('Rate limit windowMs must be a positive integer');
  }

  const entries = new Map<string, RateLimitEntry>();
  let requestsUntilCleanup = 100;

  return (request, response, next) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const current = entries.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    entry.count += 1;
    entries.set(key, entry);

    response.setHeader('RateLimit-Limit', String(options.maxRequests));
    response.setHeader(
      'RateLimit-Remaining',
      String(Math.max(0, options.maxRequests - entry.count)),
    );
    response.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    requestsUntilCleanup -= 1;
    if (requestsUntilCleanup === 0) {
      requestsUntilCleanup = 100;
      for (const [storedKey, storedEntry] of entries) {
        if (storedEntry.resetAt <= now) entries.delete(storedKey);
      }
    }

    if (entry.count > options.maxRequests) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))),
      );
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many authentication attempts',
        },
      });
      return;
    }

    next();
  };
}
