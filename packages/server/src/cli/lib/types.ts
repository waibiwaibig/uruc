export type UiLanguage = 'zh-CN' | 'en' | 'ko';
export type CityReachability = 'local' | 'lan' | 'server';
export type InstancePurpose = 'test' | 'production';
export type SiteProtocol = 'http' | 'https';
export type ConfigureMode = 'quickstart' | 'advanced';
export type ConfigureSection = 'runtime' | 'access' | 'city' | 'plugins' | 'integrations';
export type ConfigurePluginPreset = 'social-only' | 'empty-core' | 'custom';
export type BundledPluginId = 'uruc.social';
export type BundledPluginState = Record<BundledPluginId, boolean>;

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
  mode: ConfigureMode;
  section: ConfigureSection | 'all';
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
  cityConfigPath: string;
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
  pluginPreset: ConfigurePluginPreset;
  pluginStoreDir: string;
  bundledPluginState: BundledPluginState;
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
