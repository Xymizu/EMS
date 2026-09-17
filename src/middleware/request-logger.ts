import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = randomUUID();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);

  response.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(JSON.stringify({
      level: 'info',
      event: 'http_request',
      requestId,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    }));
  });
  next();
};
