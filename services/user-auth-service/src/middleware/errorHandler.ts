import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types';

/**
 * Centralised error-handling middleware.
 * Must be registered LAST in the Express middleware chain (after all routes).
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error('[ErrorHandler]', err.stack ?? err.message);

  const body: ApiErrorResponse = {
    error: 'InternalServerError',
    message: 'An unexpected error occurred. Please try again later.',
    statusCode: 500,
  };

  res.status(500).json(body);
};

/**
 * 404 handler — catches requests that don't match any registered route.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const body: ApiErrorResponse = {
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  };

  res.status(404).json(body);
};
