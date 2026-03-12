import { describe, expect, it } from 'vitest';

import {
  buildBaseUrl,
  buildSiteUrl,
  defaultBindHostForExposure,
  legacyDeploymentModeToExposure,
  normalizeAppBasePath,
} from '../lib/env.js';

describe('configure env helpers', () => {
  it('maps legacy deployment modes to runtime exposure modes', () => {
    expect(legacyDeploymentModeToExposure('local')).toBe('local-only');
    expect(legacyDeploymentModeToExposure('server')).toBe('direct-public');
  });

  it('uses localhost binding only for local-only exposure', () => {
    expect(defaultBindHostForExposure('local-only')).toBe('127.0.0.1');
    expect(defaultBindHostForExposure('lan-share')).toBe('0.0.0.0');
    expect(defaultBindHostForExposure('direct-public')).toBe('0.0.0.0');
  });

  it('normalizes app base paths and site URLs', () => {
    expect(normalizeAppBasePath('app/')).toBe('/app');
    expect(normalizeAppBasePath('/')).toBe('');
    expect(buildBaseUrl('uruc.life', '443', true)).toBe('https://uruc.life');
    expect(buildSiteUrl('https://uruc.life', '/app/')).toBe('https://uruc.life/app');
  });
});
