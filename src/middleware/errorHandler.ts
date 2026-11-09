import type { ErrorRequestHandler, RequestHandler } from 'express';

export class ApiError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function resolveStatusCode(error: unknown): number {
  if (isApiError(error)) {
    return error.statusCode;
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return status;
    }
  }

  return 500;
}

function resolveMessage(error: unknown, statusCode: number): string {
  if (statusCode < 500 && error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'production' && error instanceof Error) {
    return error.message;
  }

  return 'Internal server error';
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      status: 404,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = resolveStatusCode(error);

  if (statusCode >= 500) {
    console.error('[TaskFlow API] Unhandled error:', error);
  }

  res.status(statusCode).json({
    error: {
      status: statusCode,
      message: resolveMessage(error, statusCode),
    },
  });
};
