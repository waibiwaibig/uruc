export type UiLanguage = 'zh-CN' | 'en' | 'ko';
export type CityReachability = 'local' | 'lan' | 'server';
export type InstancePurpose = 'test' | 'production';
export type SiteProtocol = 'http' | 'https';

export interface CliMeta {
  language: UiLanguage;
  reachability?: CityReachability;
  purpose?: InstancePurpose;
  serviceName?: string;
  configure?: {
    completedAt: string;
    reachability?: CityReachability;
    siteUrl?: string;
    wsUrl?: string;
    bindHost?: string;
  };
}

export interface BuildState {
  builtAt: string;
  newestInputMtimeMs: number;
  oldestOutputMtimeMs: number;
  outputs: string[];
}

export interface ManagedProcessState {
  pid: number;
  logPath: string;
  startedAt: string;
  command: string[];
}

export interface OutputOptions {
  json?: boolean;
  lang?: UiLanguage;
}

export interface ConfigureAnswers {
  lang: UiLanguage;
  reachability: CityReachability;
  purpose: InstancePurpose;
  bindHost: string;
  publicHost: string;
  siteProtocol: SiteProtocol;
  httpPort: string;
  wsPort: string;
  adminUsername: string;
  adminPassword: string;
  adminEmail: string;
  allowRegister: boolean;
  noindex: boolean;
  sitePassword: string;
  dbPath: string;
  pluginConfigPath: string;
  allowedOrigins: string;
  jwtSecret: string;
  baseUrl: string;
  publicDir: string;
  uploadsDir: string;
  resendApiKey: string;
  fromEmail: string;
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
}

export interface CommandContext {
  args: string[];
  json: boolean;
  lang?: UiLanguage;
}

export interface HealthStatus {
  ok: boolean;
  statusCode?: number;
  url: string;
  body?: unknown;
  error?: string;
}
