export type UiLanguage = 'zh-CN' | 'en' | 'ko';
export type DeploymentMode = 'local' | 'server';
export type InstancePurpose = 'test' | 'production';

export interface CliMeta {
  language: UiLanguage;
  deploymentMode?: DeploymentMode;
  purpose?: InstancePurpose;
  serviceName?: string;
  install?: {
    completedAt: string;
    publicHost?: string;
    siteUrl?: string;
    healthUrl?: string;
    wsUrl?: string;
    systemdInstalled?: boolean;
    nginxConfigured?: boolean;
    sslEnabled?: boolean;
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

export interface SetupAnswers {
  lang: UiLanguage;
  mode: DeploymentMode;
  purpose: InstancePurpose;
  publicHost: string;
  enableSsl: boolean;
  letsencryptEmail: string;
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
