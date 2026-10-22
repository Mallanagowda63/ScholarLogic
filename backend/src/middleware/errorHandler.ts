import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // The database link dropped for a moment (e.g. "connection <monitor> to … closed"): ask to retry, don't show driver text
  const dbDown =
    /^Mongo(Network|ServerSelection|NotConnected|PoolCleared|NetworkTimeout)/.test(String(err?.name || '')) ||
    /connection .* (closed|timed out)|ECONNRESET|buffering timed out|Topology is closed/i.test(String(err?.message || ''));
  const statusCode = dbDown ? 503 : err.statusCode || 500;
  const code = dbDown ? 'DB_UNAVAILABLE' : err.code || 'INTERNAL_SERVER_ERROR';
  const message = dbDown
    ? 'The server lost its database connection for a moment. Please try again.'
    : err.message || 'An unexpected error occurred';
  if (dbDown) console.warn(`⚠️ Database connection problem on ${req.method} ${req.originalUrl}: ${err?.message}`);

  if (env.NODE_ENV !== 'production' && statusCode === 500) {
    console.error('❌ Server Error Trace:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
};
