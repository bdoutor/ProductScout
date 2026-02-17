import type { RequestHandler } from 'express';

type RateLimitOptions = { windowMs?: number; max?: number };

export function safeHelmet(): RequestHandler {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const helmet = require('helmet');
    return helmet();
  } catch {
    // No-op middleware if helmet is not installed
    return (_req, _res, next) => next();
  }
}

export function safeRateLimit(_opts?: RateLimitOptions): RequestHandler {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rateLimit = require('express-rate-limit');
    return rateLimit(_opts || { windowMs: 60_000, max: 120 });
  } catch {
    // No-op middleware if express-rate-limit is not installed
    return (_req, _res, next) => next();
  }
}

