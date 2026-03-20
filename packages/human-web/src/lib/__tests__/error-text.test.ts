import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '../../i18n';
import { localizeCoreError } from '../error-text';

describe('localizeCoreError', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('returns the translated human-readable message for known core codes', () => {
    expect(localizeCoreError('BAD_REQUEST')).toBe('The request is invalid.');
  });
});
