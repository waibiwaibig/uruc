import { describe, expect, it } from 'vitest';

import { CORE_ERROR_CODES, resolveError } from '../errors.js';

describe('resolveError', () => {
  it('preserves plugin-shaped error metadata when core wrappers rethrow it', () => {
    const error = new Error('Leave or stop watching your current table first.') as Error & {
      code?: string;
      action?: string;
      details?: Record<string, unknown>;
    };
    error.code = 'ARCADE_TABLE_ACTIVE';
    error.action = 'leave_table';
    error.details = { tableId: 'table-1' };

    const resolved = resolveError(error, {
      status: 400,
      code: CORE_ERROR_CODES.BAD_REQUEST,
      error: 'Unable to leave the current location.',
    });

    expect(resolved.status).toBe(400);
    expect(resolved.payload).toEqual({
      error: 'Leave or stop watching your current table first.',
      code: 'ARCADE_TABLE_ACTIVE',
      action: 'leave_table',
      details: { tableId: 'table-1' },
    });
  });
});
