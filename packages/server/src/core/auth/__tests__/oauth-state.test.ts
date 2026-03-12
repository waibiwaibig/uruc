import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('OAuth state store cap', () => {
    it('source contains MAX_STATE_STORE constant', () => {
        const src = readFileSync(
            resolve(__dirname, '..', 'oauth.ts'),
            'utf-8',
        );
        expect(src).toContain('MAX_STATE_STORE');
    });
});
