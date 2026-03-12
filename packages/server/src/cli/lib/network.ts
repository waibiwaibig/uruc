import { buildBaseUrl } from './env.js';
import type { SiteProtocol } from './types.js';

export function buildSiteUrl(
  protocol: SiteProtocol,
  publicHost: string,
  httpPort: string,
  explicitBaseUrl?: string,
): string {
  return explicitBaseUrl && explicitBaseUrl.trim() !== ''
    ? explicitBaseUrl.replace(/\/$/, '')
    : buildBaseUrl(protocol, publicHost, httpPort);
}

export function buildPublicWsUrl(siteUrl: string, wsPort: string): string {
  try {
    const parsed = new URL(siteUrl);
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${parsed.hostname}:${wsPort}`;
  } catch {
    return `ws://127.0.0.1:${wsPort}`;
  }
}

export function buildHealthUrl(bindHost: string, httpPort: string): string {
  const host = bindHost === '0.0.0.0' ? '127.0.0.1' : bindHost;
  return `http://${host}:${httpPort}/api/health`;
}
