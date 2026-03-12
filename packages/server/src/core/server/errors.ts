import type { IncomingMessage, ServerResponse } from 'http';

import type { WSErrorPayload } from '../plugin-system/hook-registry.js';
import { sendError } from './middleware.js';

export const CORE_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_VERIFICATION_CODE: 'INVALID_VERIFICATION_CODE',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  OAUTH_STATE_INVALID: 'OAUTH_STATE_INVALID',
  OAUTH_EXCHANGE_FAILED: 'OAUTH_EXCHANGE_FAILED',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  INVALID_JSON: 'INVALID_JSON',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export interface AppErrorOptions {
  code: string;
  error: string;
  status?: number;
  retryable?: boolean;
  action?: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable?: boolean;
  readonly action?: string;
  readonly details?: Record<string, unknown>;

  constructor(opts: AppErrorOptions) {
    super(opts.error);
    this.name = 'AppError';
    this.code = opts.code;
    this.status = opts.status ?? 400;
    this.retryable = opts.retryable;
    this.action = opts.action;
    this.details = opts.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

interface ErrorFallback extends AppErrorOptions {
  status: number;
}

export function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return CORE_ERROR_CODES.BAD_REQUEST;
    case 401:
      return CORE_ERROR_CODES.UNAUTHORIZED;
    case 403:
      return CORE_ERROR_CODES.FORBIDDEN;
    case 404:
      return CORE_ERROR_CODES.NOT_FOUND;
    case 429:
      return CORE_ERROR_CODES.RATE_LIMITED;
    default:
      return status >= 500 ? CORE_ERROR_CODES.INTERNAL_ERROR : CORE_ERROR_CODES.BAD_REQUEST;
  }
}

export function resolveError(
  error: unknown,
  fallback: ErrorFallback,
): { status: number; payload: WSErrorPayload } {
  if (isAppError(error)) {
    return {
      status: error.status,
      payload: {
        error: error.message,
        code: error.code,
        ...(error.retryable !== undefined ? { retryable: error.retryable } : {}),
        ...(error.action !== undefined ? { action: error.action } : {}),
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: fallback.status,
      payload: {
        error: error.message,
        code: fallback.code,
        ...(fallback.retryable !== undefined ? { retryable: fallback.retryable } : {}),
        ...(fallback.action !== undefined ? { action: fallback.action } : {}),
        ...(fallback.details !== undefined ? { details: fallback.details } : {}),
      },
    };
  }

  return {
    status: fallback.status,
    payload: {
      error: fallback.error,
      code: fallback.code,
      ...(fallback.retryable !== undefined ? { retryable: fallback.retryable } : {}),
      ...(fallback.action !== undefined ? { action: fallback.action } : {}),
      ...(fallback.details !== undefined ? { details: fallback.details } : {}),
    },
  };
}

export function sendHttpError(
  res: ServerResponse,
  req: IncomingMessage,
  error: unknown,
  fallback: ErrorFallback,
): void {
  const resolved = resolveError(error, fallback);
  sendError(res, resolved.status, resolved.payload, req);
}
