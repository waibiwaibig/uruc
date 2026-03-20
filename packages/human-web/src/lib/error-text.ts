import i18n from '../i18n';

const KNOWN_CORE_CODES = new Set([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'USERNAME_TAKEN',
  'EMAIL_TAKEN',
  'EMAIL_NOT_VERIFIED',
  'INVALID_VERIFICATION_CODE',
  'WEAK_PASSWORD',
  'OAUTH_STATE_INVALID',
  'OAUTH_EXCHANGE_FAILED',
  'UNKNOWN_COMMAND',
  'INVALID_JSON',
  'INTERNAL_ERROR',
  'USER_BANNED',
  'INVALID_TOKEN',
  'USER_NOT_FOUND',
  'AGENT_FROZEN',
  'CONTROLLED_ELSEWHERE',
  'NOT_CONTROLLER',
  'NOT_AUTHENTICATED',
  'NO_HANDLER',
]);

export function isKnownCoreErrorCode(code?: string | null): boolean {
  return Boolean(code && KNOWN_CORE_CODES.has(code));
}

export function localizeCoreError(code: string | undefined, fallback?: string, status?: number): string {
  if (isKnownCoreErrorCode(code)) {
    return i18n.t(`errors:code.${code}`);
  }
  if (fallback) return fallback;
  return i18n.t('errors.fallback.requestFailed', { status: status ?? 500 });
}
