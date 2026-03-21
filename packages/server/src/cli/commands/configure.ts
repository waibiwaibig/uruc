import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

import {
  adminExists,
  createAdmin,
  findUserByEmail,
  getUserRole,
  resolveAdminPasswordState,
  resetAdminPassword,
} from '../lib/admin.js';
import { hasFlag, readOption } from '../lib/argv.js';
import {
  DEFAULT_PLUGIN_PRESET,
  DEFAULT_PLUGIN_STORE_DIR,
  detectBundledPluginState,
  ensureCityConfig,
  getBundledPluginPresetState,
  inferPluginPreset,
  rebaseCityConfigPaths,
  syncCityLock,
} from '../lib/city.js';
import {
  getConfigureActions,
  getConfigureSummaryLines,
  rememberConfiguration,
} from '../lib/configure.js';
import {
  buildBaseUrl,
  configureAnswersToEnv,
  currentConfigureDefaults,
  defaultBindHost,
  defaultConfig,
  ensureServerEnvFile,
  getCurrentLanguage,
  inferReachability,
  inferSiteProtocol,
  parseEnvFile,
  rootEnvExists,
  writeEnvFile,
} from '../lib/env.js';
import { buildPublicWsUrl } from '../lib/network.js';
import { readCliMeta } from '../lib/state.js';
import {
  printBanner,
  printSection,
  printStatus,
  promptChoice,
  promptConfirm,
  promptInput,
} from '../lib/ui.js';
import { getRuntimeStatus, isSystemdInstalled, type RuntimeStatus } from '../lib/runtime.js';
import type {
  BundledPluginId,
  BundledPluginState,
  CityReachability,
  CommandContext,
  ConfigureAnswers,
  ConfigureMode,
  ConfigurePluginPreset,
  ConfigureSection,
  InstancePurpose,
  SiteProtocol,
  UiLanguage,
} from '../lib/types.js';
import { readCityConfig } from '../../core/plugin-platform/config.js';
import type { CityConfigFile, CityPluginSource } from '../../core/plugin-platform/types.js';
import { getCityLockPath, getPackageRoot } from '../../runtime-paths.js';

interface ConfigureResult {
  answers: ConfigureAnswers;
  adminAction: 'create' | 'keep' | 'reset';
  generatedPassword: boolean;
  baseCityConfig: CityConfigFile;
  cityConfigResolvedPath: string;
}

const packageRoot = getPackageRoot();

const BUNDLED_PLUGIN_LABELS: Record<BundledPluginId, string> = {
  'uruc.social': 'Social',
};

const copy = {
  'zh-CN': {
    title: 'Configure',
    invalidRootEnv: '检测到仓库根目录 .env：当前 CLI 不会读取它，真正生效的是 packages/server/.env。',
    modePrompt: '这次你想怎么配置主城？',
    quickstartMode: 'QuickStart',
    quickstartModeDesc: '更少问题，直接得到一套可启动的城市',
    advancedMode: 'Advanced',
    advancedModeDesc: '按分节精细调整运行、访问、城市和插件',
    sectionPrompt: '这次要改哪一块？',
    sectionAll: '全部',
    sectionAllDesc: '完整重配运行、访问、城市、插件和集成',
    sectionRuntime: 'runtime',
    sectionRuntimeDesc: '监听地址、分享地址、端口、静态目录',
    sectionAccess: 'access',
    sectionAccessDesc: '管理员、注册、收录、站点访问控制',
    sectionCity: 'city',
    sectionCityDesc: '数据库与城市配置路径',
    sectionPlugins: 'plugins',
    sectionPluginsDesc: '插件预设、启用状态、source、plugin store',
    sectionIntegrations: 'integrations',
    sectionIntegrationsDesc: 'CORS、JWT、邮件与 OAuth',
    reachabilityPrompt: '你要把这座城市建在哪里？',
    purposePrompt: '这个实例的用途是什么？',
    localMode: '本机',
    lanMode: '局域网',
    serverMode: '服务器',
    localModeDesc: '只允许当前机器访问',
    lanModeDesc: '同一局域网内的设备都可以进入',
    serverModeDesc: '对公网地址或域名开放',
    lanHostPrompt: '局域网分享地址（同网段设备访问它）',
    serverHostPrompt: '公网地址（域名或公网 IP）',
    protocolPrompt: '对外分享时使用什么协议？',
    protocolHttp: 'HTTP（默认直接可用）',
    protocolHttps: 'HTTPS（需你自己接 TLS / 反向代理）',
    httpPortPrompt: 'HTTP 端口',
    wsPortPrompt: 'WebSocket 端口',
    adminUserPrompt: '管理员用户名',
    adminPasswordPrompt: '管理员密码',
    adminEmailPrompt: '管理员邮箱',
    allowRegisterPrompt: '是否允许他人自行注册进入？',
    noindexPrompt: '是否禁止搜索引擎收录？',
    sitePasswordPrompt: '站点访问密码（可选）',
    dbPathPrompt: '数据库路径',
    cityConfigPrompt: '城市配置文件路径',
    pluginStoreDirPrompt: '插件 store 路径',
    allowedOriginsPrompt: '允许访问 API 的前端地址（逗号分隔）',
    jwtSecretPrompt: 'JWT 密钥',
    publicDirPrompt: '前端静态目录',
    uploadsDirPrompt: '上传目录',
    resendPrompt: '是否配置邮件发送？',
    resendKeyPrompt: 'Resend API Key',
    fromEmailPrompt: '发信邮箱',
    googlePrompt: '是否启用 Google OAuth？',
    googleIdPrompt: 'Google Client ID',
    googleSecretPrompt: 'Google Client Secret',
    githubPrompt: '是否启用 GitHub OAuth？',
    githubIdPrompt: 'GitHub Client ID',
    githubSecretPrompt: 'GitHub Client Secret',
    pluginPresetPrompt: '这座城市想用哪套插件预设？',
    presetSocial: 'social-only',
    presetSocialDesc: '启用内置 social 插件',
    presetEmpty: 'empty-core',
    presetEmptyDesc: '只启动主城核心，不启用任何 bundled 插件',
    presetCustom: 'custom',
    presetCustomDesc: '手动决定是否启用内置 social 插件',
    editSourcesPrompt: '是否顺手调整插件 source？',
    sourceActionPrompt: '要怎么处理当前 source？',
    sourceAdd: '添加 source',
    sourceRemove: '移除 source',
    sourceDone: '保持当前 source 并继续',
    sourceIdPrompt: 'source id',
    sourceRegistryPrompt: 'source registry（目录或 uruc-registry.json 路径）',
    sourceRemovePrompt: '要移除哪个 source？',
    noSources: '当前没有配置 source。',
    existingAdminPrompt: '这个管理员用户名已经存在，你想怎么处理？',
    existingUserPrompt: '这个用户名已经存在，但它不是管理员。请改用新用户名，或稍后用 `uruc admin promote`。',
    keepAdmin: '保持现有账号不变',
    resetAdmin: '重置该账号密码',
    renameAdmin: '换一个新的管理员用户名',
    keepPasswordPrompt: '请输入现有管理员密码（用于验证）',
    summaryTitle: '城市配置摘要',
    runtimeSummaryTitle: '运行设置变更',
    citySummaryTitle: '城市 / 插件变更',
    adminSummaryTitle: '管理员变更',
    actionsTitle: '即将执行',
    applyPrompt: '配置完成后怎么处理？',
    startForeground: '保存并前台启动',
    startBackground: '保存并后台启动',
    saveOnly: '只保存配置',
    editAgain: '返回修改',
    generatedPassword: '管理员密码未输入，已自动生成。',
    finishedTitle: '完成',
    savedOnly: '配置已保存，城市配置和 lock 也已同步。稍后可直接运行 `uruc start`。',
    httpsNotice: '你选择了 HTTPS 分享地址。Uruc 不会自动配置证书或反向代理；如需真正对外 HTTPS，请自行接入 TLS。',
    enableBundledPrompt: '是否启用 bundled 插件',
    sourcesSummary: '已配置 source',
  },
  en: {
    title: 'Configure',
    invalidRootEnv: 'A repo-root .env was found. Uruc ignores it; only packages/server/.env is active.',
    modePrompt: 'How should we configure this city?',
    quickstartMode: 'QuickStart',
    quickstartModeDesc: 'Ask fewer questions and leave with a runnable city',
    advancedMode: 'Advanced',
    advancedModeDesc: 'Tune runtime, access, city, plugins, and integrations by section',
    sectionPrompt: 'Which section do you want to change?',
    sectionAll: 'all',
    sectionAllDesc: 'Reconfigure runtime, access, city, plugins, and integrations',
    sectionRuntime: 'runtime',
    sectionRuntimeDesc: 'Bind host, share URL, ports, static directories',
    sectionAccess: 'access',
    sectionAccessDesc: 'Admins, registration, indexing, site access control',
    sectionCity: 'city',
    sectionCityDesc: 'Database and city config paths',
    sectionPlugins: 'plugins',
    sectionPluginsDesc: 'Plugin presets, enabled state, sources, plugin store',
    sectionIntegrations: 'integrations',
    sectionIntegrationsDesc: 'CORS, JWT, email, and OAuth',
    reachabilityPrompt: 'Where should this city be reachable?',
    purposePrompt: 'What is this instance for?',
    localMode: 'Local machine',
    lanMode: 'LAN',
    serverMode: 'Server',
    localModeDesc: 'Only this machine can enter',
    lanModeDesc: 'Devices on the same LAN can enter',
    serverModeDesc: 'Expose a public host or domain',
    lanHostPrompt: 'LAN share host',
    serverHostPrompt: 'Public host (domain or public IP)',
    protocolPrompt: 'Which external protocol should people use?',
    protocolHttp: 'HTTP (works directly by default)',
    protocolHttps: 'HTTPS (you manage TLS / reverse proxy)',
    httpPortPrompt: 'HTTP port',
    wsPortPrompt: 'WebSocket port',
    adminUserPrompt: 'Admin username',
    adminPasswordPrompt: 'Admin password',
    adminEmailPrompt: 'Admin email',
    allowRegisterPrompt: 'Allow other people to self-register?',
    noindexPrompt: 'Block search engine indexing?',
    sitePasswordPrompt: 'Site access password (optional)',
    dbPathPrompt: 'Database path',
    cityConfigPrompt: 'City config path',
    pluginStoreDirPrompt: 'Plugin store path',
    allowedOriginsPrompt: 'Allowed frontend origins (comma-separated)',
    jwtSecretPrompt: 'JWT secret',
    publicDirPrompt: 'Static site directory',
    uploadsDirPrompt: 'Uploads directory',
    resendPrompt: 'Configure email delivery?',
    resendKeyPrompt: 'Resend API Key',
    fromEmailPrompt: 'From email',
    googlePrompt: 'Enable Google OAuth?',
    googleIdPrompt: 'Google Client ID',
    googleSecretPrompt: 'Google Client Secret',
    githubPrompt: 'Enable GitHub OAuth?',
    githubIdPrompt: 'GitHub Client ID',
    githubSecretPrompt: 'GitHub Client Secret',
    pluginPresetPrompt: 'Which bundled plugin preset should this city use?',
    presetSocial: 'social-only',
    presetSocialDesc: 'Enable the bundled social plugin',
    presetEmpty: 'empty-core',
    presetEmptyDesc: 'Run only the city core with no bundled plugins enabled',
    presetCustom: 'custom',
    presetCustomDesc: 'Choose whether to enable the bundled social plugin',
    editSourcesPrompt: 'Adjust plugin sources while we are here?',
    sourceActionPrompt: 'How should Uruc update the current sources?',
    sourceAdd: 'Add source',
    sourceRemove: 'Remove source',
    sourceDone: 'Keep current sources and continue',
    sourceIdPrompt: 'Source id',
    sourceRegistryPrompt: 'Source registry (directory or uruc-registry.json path)',
    sourceRemovePrompt: 'Which source should be removed?',
    noSources: 'No plugin sources are configured yet.',
    existingAdminPrompt: 'This admin username already exists. How should configure handle it?',
    existingUserPrompt: 'This username already exists but is not an admin. Pick a new username or promote it later with `uruc admin promote`.',
    keepAdmin: 'Keep the existing admin account',
    resetAdmin: 'Reset that admin password',
    renameAdmin: 'Choose a new admin username',
    keepPasswordPrompt: 'Enter the current admin password for verification',
    summaryTitle: 'City configuration summary',
    runtimeSummaryTitle: 'Runtime changes',
    citySummaryTitle: 'City and plugin changes',
    adminSummaryTitle: 'Admin changes',
    actionsTitle: 'Planned actions',
    applyPrompt: 'What should Uruc do next?',
    startForeground: 'Save and start in foreground',
    startBackground: 'Save and start in background',
    saveOnly: 'Save config only',
    editAgain: 'Go back and edit',
    generatedPassword: 'No admin password was entered, so Uruc generated one.',
    finishedTitle: 'Done',
    savedOnly: 'Configuration saved, and city config plus lock are ready. Run `uruc start` whenever you want the city online.',
    httpsNotice: 'You chose an HTTPS share URL. Uruc will not provision certificates or a reverse proxy; you must handle TLS yourself.',
    enableBundledPrompt: 'Enable bundled plugin',
    sourcesSummary: 'Configured sources',
  },
  ko: {
    title: 'Configure',
    invalidRootEnv: '저장소 루트의 .env 가 감지되었습니다. Uruc 는 이를 무시하며 packages/server/.env 만 사용합니다.',
    modePrompt: '이번에는 어떤 방식으로 도시를 구성할까요?',
    quickstartMode: 'QuickStart',
    quickstartModeDesc: '질문을 줄이고 바로 실행 가능한 도시를 만듭니다',
    advancedMode: 'Advanced',
    advancedModeDesc: 'runtime, access, city, plugins, integrations 를 섹션별로 조정합니다',
    sectionPrompt: '이번에 바꿀 섹션은 무엇인가요?',
    sectionAll: 'all',
    sectionAllDesc: '모든 섹션을 다시 구성합니다',
    sectionRuntime: 'runtime',
    sectionRuntimeDesc: '바인드 주소, 공유 URL, 포트, 정적 디렉터리',
    sectionAccess: 'access',
    sectionAccessDesc: '관리자, 가입, 색인, 사이트 접근 제어',
    sectionCity: 'city',
    sectionCityDesc: 'DB 와 도시 설정 경로',
    sectionPlugins: 'plugins',
    sectionPluginsDesc: '플러그인 프리셋, 활성화 상태, source, store',
    sectionIntegrations: 'integrations',
    sectionIntegrationsDesc: 'CORS, JWT, 메일, OAuth',
    reachabilityPrompt: '이 도시를 어디까지 열어둘까요?',
    purposePrompt: '이 인스턴스의 용도는 무엇입니까?',
    localMode: '로컬',
    lanMode: 'LAN',
    serverMode: '서버',
    localModeDesc: '현재 장치만 접속',
    lanModeDesc: '같은 LAN 장치가 접속',
    serverModeDesc: '공개 호스트 또는 도메인으로 노출',
    lanHostPrompt: 'LAN 공유 호스트',
    serverHostPrompt: '공개 호스트 (도메인 또는 공인 IP)',
    protocolPrompt: '외부에서 어떤 프로토콜로 접속합니까?',
    protocolHttp: 'HTTP (기본적으로 바로 사용 가능)',
    protocolHttps: 'HTTPS (TLS / 리버스 프록시는 직접 관리)',
    httpPortPrompt: 'HTTP 포트',
    wsPortPrompt: 'WebSocket 포트',
    adminUserPrompt: '관리자 사용자명',
    adminPasswordPrompt: '관리자 비밀번호',
    adminEmailPrompt: '관리자 이메일',
    allowRegisterPrompt: '다른 사용자가 직접 가입할 수 있게 할까요?',
    noindexPrompt: '검색 엔진 색인을 차단할까요?',
    sitePasswordPrompt: '사이트 접근 비밀번호 (선택)',
    dbPathPrompt: '데이터베이스 경로',
    cityConfigPrompt: '도시 설정 파일 경로',
    pluginStoreDirPrompt: '플러그인 store 경로',
    allowedOriginsPrompt: '허용할 프론트엔드 origin (쉼표 구분)',
    jwtSecretPrompt: 'JWT 비밀키',
    publicDirPrompt: '정적 사이트 디렉터리',
    uploadsDirPrompt: '업로드 디렉터리',
    resendPrompt: '이메일 발송을 설정하시겠습니까?',
    resendKeyPrompt: 'Resend API Key',
    fromEmailPrompt: '발신 이메일',
    googlePrompt: 'Google OAuth를 사용하시겠습니까?',
    googleIdPrompt: 'Google Client ID',
    googleSecretPrompt: 'Google Client Secret',
    githubPrompt: 'GitHub OAuth를 사용하시겠습니까?',
    githubIdPrompt: 'GitHub Client ID',
    githubSecretPrompt: 'GitHub Client Secret',
    pluginPresetPrompt: '이 도시는 어떤 bundled 플러그인 프리셋을 사용할까요?',
    presetSocial: 'social-only',
    presetSocialDesc: '내장 social 플러그인을 활성화',
    presetEmpty: 'empty-core',
    presetEmptyDesc: 'bundled 플러그인 없이 도시 코어만 실행',
    presetCustom: 'custom',
    presetCustomDesc: '내장 social 플러그인 활성화를 직접 선택',
    editSourcesPrompt: '이 자리에서 plugin source 도 조정할까요?',
    sourceActionPrompt: '현재 source 를 어떻게 처리할까요?',
    sourceAdd: 'source 추가',
    sourceRemove: 'source 제거',
    sourceDone: '현재 source 를 유지하고 계속',
    sourceIdPrompt: 'source id',
    sourceRegistryPrompt: 'source registry (디렉터리 또는 uruc-registry.json 경로)',
    sourceRemovePrompt: '어떤 source 를 제거할까요?',
    noSources: '설정된 plugin source 가 없습니다.',
    existingAdminPrompt: '이 관리자 사용자명이 이미 존재합니다. 어떻게 처리하시겠습니까?',
    existingUserPrompt: '이 사용자명은 존재하지만 관리자가 아닙니다. 새 이름을 쓰거나 나중에 `uruc admin promote` 를 사용하세요.',
    keepAdmin: '기존 관리자 계정 유지',
    resetAdmin: '해당 관리자 비밀번호 재설정',
    renameAdmin: '새 관리자 사용자명 선택',
    keepPasswordPrompt: '검증을 위해 현재 관리자 비밀번호를 입력하세요',
    summaryTitle: '도시 설정 요약',
    runtimeSummaryTitle: '런타임 변경',
    citySummaryTitle: '도시 및 플러그인 변경',
    adminSummaryTitle: '관리자 변경',
    actionsTitle: '실행 예정 작업',
    applyPrompt: '다음으로 무엇을 할까요?',
    startForeground: '저장 후 포그라운드 시작',
    startBackground: '저장 후 백그라운드 시작',
    saveOnly: '설정만 저장',
    editAgain: '다시 수정',
    generatedPassword: '관리자 비밀번호가 비어 있어 Uruc가 자동 생성했습니다.',
    finishedTitle: '완료',
    savedOnly: '설정을 저장했고 도시 설정과 lock 도 준비했습니다. 원할 때 `uruc start` 를 실행하세요.',
    httpsNotice: 'HTTPS 공유 주소를 선택했습니다. Uruc 는 인증서나 리버스 프록시를 자동 구성하지 않으므로 TLS 는 직접 처리해야 합니다.',
    enableBundledPrompt: 'bundled 플러그인 활성화',
    sourcesSummary: '설정된 source',
  },
} as const;

function text(lang: UiLanguage, key: keyof typeof copy['zh-CN']): string {
  return copy[lang][key];
}

function sitePasswordClearHint(lang: UiLanguage): string {
  if (lang === 'zh-CN') return '输入 - 清空';
  if (lang === 'ko') return '- 입력 시 비움';
  return 'type - to clear';
}

type ConfigureApplyAction = 'start-foreground' | 'start-managed' | 'save' | 'edit';

function managedStartLabel(
  lang: UiLanguage,
  runtimeMode: RuntimeStatus['mode'],
): string {
  if (runtimeMode === 'background') {
    if (lang === 'zh-CN') return '保存并重启后台实例';
    if (lang === 'ko') return '저장 후 백그라운드 인스턴스 재시작';
    return 'Save and restart background instance';
  }

  if (runtimeMode === 'systemd') {
    if (lang === 'zh-CN') return '保存并重启服务';
    if (lang === 'ko') return '저장 후 서비스 재시작';
    return 'Save and restart service';
  }

  if (lang === 'zh-CN') return '保存并启动服务';
  if (lang === 'ko') return '저장 후 서비스 시작';
  return 'Save and start service';
}

function unmanagedSaveWarning(lang: UiLanguage): string {
  if (lang === 'zh-CN') {
    return '检测到一个未受 CLI 管理的本地实例。为避免和现有进程抢占端口，configure 这次只提供保存配置。';
  }
  if (lang === 'ko') {
    return 'CLI가 관리하지 않는 로컬 인스턴스가 감지되었습니다. 현재 프로세스와 포트 충돌을 피하기 위해 이번 configure 에서는 저장만 제공합니다.';
  }
  return 'A local instance is running outside CLI management. Configure will only offer save-only this time to avoid conflicting with that process.';
}

function getApplyChoices(
  lang: UiLanguage,
  runtimeStatus: RuntimeStatus,
  systemdInstalled: boolean,
): Array<{ value: ConfigureApplyAction; label: string }> {
  if (runtimeStatus.mode === 'unmanaged') {
    return [
      { value: 'save', label: text(lang, 'saveOnly') },
      { value: 'edit', label: text(lang, 'editAgain') },
    ];
  }

  if (runtimeStatus.mode === 'background') {
    return [
      { value: 'start-managed', label: managedStartLabel(lang, runtimeStatus.mode) },
      { value: 'save', label: text(lang, 'saveOnly') },
      { value: 'edit', label: text(lang, 'editAgain') },
    ];
  }

  if (systemdInstalled) {
    return [
      { value: 'start-managed', label: managedStartLabel(lang, runtimeStatus.mode) },
      { value: 'save', label: text(lang, 'saveOnly') },
      { value: 'edit', label: text(lang, 'editAgain') },
    ];
  }

  return [
    { value: 'start-foreground', label: text(lang, 'startForeground') },
    { value: 'start-managed', label: text(lang, 'startBackground') },
    { value: 'save', label: text(lang, 'saveOnly') },
    { value: 'edit', label: text(lang, 'editAgain') },
  ];
}

function safeHostFromBaseUrl(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    return new URL(raw).hostname || fallback;
  } catch {
    return fallback;
  }
}

function detectLanHost(): string {
  const interfaces = os.networkInterfaces();
  for (const items of Object.values(interfaces)) {
    for (const item of items ?? []) {
      if (item.internal) continue;
      if (item.family === 'IPv4') return item.address;
    }
  }
  return '192.168.1.10';
}

function resolveCityConfigPath(rawPath: string): string {
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(packageRoot, rawPath);
}

function keepConfiguredPath(currentValue: string | undefined, fallbackValue: string): string {
  if (typeof currentValue === 'string' && currentValue.trim() !== '') {
    return currentValue;
  }
  return fallbackValue;
}

function validateRequestedSection(value: string | undefined): ConfigureSection | undefined {
  if (value === undefined) return undefined;
  if (value === 'runtime' || value === 'access' || value === 'city' || value === 'plugins' || value === 'integrations') {
    return value;
  }
  throw new Error(`Unknown configure section: ${value}`);
}

async function chooseLanguage(defaultLang: UiLanguage, acceptDefaults: boolean): Promise<UiLanguage> {
  if (acceptDefaults) {
    return defaultLang;
  }
  console.log('Uruc Configure');
  return await promptChoice(
    'Choose language / 选择语言 / 언어 선택',
    [
      { value: 'zh-CN', label: '简中' },
      { value: 'en', label: 'English' },
      { value: 'ko', label: '한국어' },
    ],
    defaultLang,
    defaultLang,
  );
}

async function chooseConfigureMode(
  lang: UiLanguage,
  forcedMode: ConfigureMode | undefined,
  forcedSection: ConfigureSection | undefined,
  acceptDefaults: boolean,
): Promise<{ mode: ConfigureMode; section: ConfigureSection | 'all' }> {
  if (forcedMode === 'quickstart' && forcedSection) {
    throw new Error('`uruc configure --quickstart` cannot be combined with `--section`. Use `--advanced --section ...` instead.');
  }
  if (acceptDefaults && forcedMode !== 'quickstart') {
    throw new Error('`uruc configure --accept-defaults` currently requires `--quickstart`.');
  }

  const mode = forcedMode ?? await promptChoice<ConfigureMode>(
    text(lang, 'modePrompt'),
    [
      { value: 'quickstart', label: text(lang, 'quickstartMode'), description: text(lang, 'quickstartModeDesc') },
      { value: 'advanced', label: text(lang, 'advancedMode'), description: text(lang, 'advancedModeDesc') },
    ],
    'quickstart',
    lang,
  );

  if (mode === 'quickstart') {
    return { mode, section: 'all' };
  }

  const section = forcedSection ?? await promptChoice<ConfigureSection | 'all'>(
    text(lang, 'sectionPrompt'),
    [
      { value: 'all', label: text(lang, 'sectionAll'), description: text(lang, 'sectionAllDesc') },
      { value: 'runtime', label: text(lang, 'sectionRuntime'), description: text(lang, 'sectionRuntimeDesc') },
      { value: 'access', label: text(lang, 'sectionAccess'), description: text(lang, 'sectionAccessDesc') },
      { value: 'city', label: text(lang, 'sectionCity'), description: text(lang, 'sectionCityDesc') },
      { value: 'plugins', label: text(lang, 'sectionPlugins'), description: text(lang, 'sectionPluginsDesc') },
      { value: 'integrations', label: text(lang, 'sectionIntegrations'), description: text(lang, 'sectionIntegrationsDesc') },
    ],
    'all',
    lang,
  );

  return { mode, section };
}

function sectionMatches(section: ConfigureSection | 'all', target: ConfigureSection): boolean {
  return section === 'all' || section === target;
}

function pluginTogglePrompt(lang: UiLanguage, pluginId: BundledPluginId): string {
  if (lang === 'zh-CN') {
    return `是否启用 bundled 插件 ${BUNDLED_PLUGIN_LABELS[pluginId]}？`;
  }
  if (lang === 'ko') {
    return `${BUNDLED_PLUGIN_LABELS[pluginId]} bundled 플러그인을 활성화할까요?`;
  }
  return `Enable bundled plugin ${BUNDLED_PLUGIN_LABELS[pluginId]}?`;
}

function adminEmailConflictMessage(
  lang: UiLanguage,
  email: string,
  owner: { username: string; role: string },
): string {
  if (lang === 'zh-CN') {
    return `管理员邮箱 ${email} 已被${owner.role === 'admin' ? '管理员' : '用户'} ${owner.username} 占用，请改用另一个邮箱。`;
  }
  if (lang === 'ko') {
    return `관리자 이메일 ${email} 은 이미 ${owner.role === 'admin' ? '관리자' : '사용자'} ${owner.username} 가 사용 중입니다. 다른 이메일을 입력하세요.`;
  }
  return `Admin email ${email} already belongs to ${owner.role} ${owner.username}. Choose a different email.`;
}

async function choosePluginPreset(lang: UiLanguage, defaultPreset: ConfigurePluginPreset): Promise<ConfigurePluginPreset> {
  return await promptChoice(
    text(lang, 'pluginPresetPrompt'),
    [
      { value: 'social-only', label: text(lang, 'presetSocial'), description: text(lang, 'presetSocialDesc') },
      { value: 'empty-core', label: text(lang, 'presetEmpty'), description: text(lang, 'presetEmptyDesc') },
      { value: 'custom', label: text(lang, 'presetCustom'), description: text(lang, 'presetCustomDesc') },
    ],
    defaultPreset,
    lang,
  );
}

async function chooseCustomBundledPlugins(lang: UiLanguage, defaults: BundledPluginState): Promise<BundledPluginState> {
  return {
    'uruc.social': await promptConfirm(pluginTogglePrompt(lang, 'uruc.social'), defaults['uruc.social'], lang),
  };
}

async function editSources(lang: UiLanguage, sources: CityPluginSource[]): Promise<CityPluginSource[]> {
  const next = [...sources];
  while (true) {
    if (next.length === 0) {
      printStatus('info', text(lang, 'noSources'));
    } else {
      printStatus('info', `${text(lang, 'sourcesSummary')}: ${next.map((source) => `${source.id} -> ${source.registry}`).join(', ')}`);
    }

    const action = await promptChoice<'done' | 'add' | 'remove'>(
      text(lang, 'sourceActionPrompt'),
      [
        { value: 'done', label: text(lang, 'sourceDone') },
        { value: 'add', label: text(lang, 'sourceAdd') },
        { value: 'remove', label: text(lang, 'sourceRemove') },
      ],
      'done',
      lang,
    );

    if (action === 'done') {
      return next;
    }

    if (action === 'add') {
      const id = await promptInput(text(lang, 'sourceIdPrompt'), '');
      const registry = await promptInput(text(lang, 'sourceRegistryPrompt'), '');
      if (!id || !registry) {
        continue;
      }
      const existingIndex = next.findIndex((source) => source.id === id);
      const value: CityPluginSource = { id, type: 'npm', registry };
      if (existingIndex >= 0) {
        next[existingIndex] = value;
      } else {
        next.push(value);
      }
      continue;
    }

    if (next.length === 0) {
      continue;
    }

    const sourceId = await promptChoice(
      text(lang, 'sourceRemovePrompt'),
      next.map((source) => ({
        value: source.id,
        label: source.id,
        description: source.registry,
      })),
      next[0]!.id,
      lang,
    );
    const removeIndex = next.findIndex((source) => source.id === sourceId);
    if (removeIndex >= 0) {
      next.splice(removeIndex, 1);
    }
  }
}

async function reconcileAdminAccount(
  answers: ConfigureAnswers,
  lang: UiLanguage,
  acceptDefaults: boolean,
): Promise<{ action: 'create' | 'keep' | 'reset'; generatedPassword: boolean; answers: ConfigureAnswers }> {
  let generatedPassword = false;

  while (true) {
    const role = await getUserRole(answers.adminUsername, answers.dbPath);
    if (role && role !== 'admin') {
      printStatus('warn', text(lang, 'existingUserPrompt'));
      answers.adminUsername = await promptInput(text(lang, 'adminUserPrompt'), `${answers.adminUsername}-admin`);
      continue;
    }

    const emailOwner = await findUserByEmail(answers.adminEmail, answers.dbPath);
    if (emailOwner && emailOwner.username !== answers.adminUsername) {
      const message = adminEmailConflictMessage(lang, answers.adminEmail, emailOwner);
      if (acceptDefaults) {
        throw new Error(message);
      }
      printStatus('warn', message);
      answers.adminEmail = await promptInput(text(lang, 'adminEmailPrompt'), answers.adminEmail);
      continue;
    }

    const exists = await adminExists(answers.adminUsername, answers.dbPath);
    if (!exists) {
      if (!answers.adminPassword) {
        answers.adminPassword = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 24);
        generatedPassword = true;
      }
      return { action: 'create', generatedPassword, answers };
    }

    const strategy = await promptChoice(
      text(lang, 'existingAdminPrompt'),
      [
        { value: 'keep', label: text(lang, 'keepAdmin') },
        { value: 'reset', label: text(lang, 'resetAdmin') },
        { value: 'rename', label: text(lang, 'renameAdmin') },
      ],
      'keep',
      lang,
    );

    if (strategy === 'rename') {
      answers.adminUsername = await promptInput(text(lang, 'adminUserPrompt'), `${answers.adminUsername}-new`);
      continue;
    }

    while (!answers.adminPassword) {
      answers.adminPassword = await promptInput(
        strategy === 'keep' ? text(lang, 'keepPasswordPrompt') : text(lang, 'adminPasswordPrompt'),
        answers.adminPassword,
        { secret: true },
      );
    }

    if (strategy === 'keep') {
      const state = await resolveAdminPasswordState(answers.adminUsername, answers.adminPassword, answers.dbPath);
      if (state === 'match') {
        return { action: 'keep', generatedPassword: false, answers };
      }
      printStatus('warn', `Admin password did not match the current database for ${answers.adminUsername}.`);
      answers.adminPassword = '';
      continue;
    }

    return { action: 'reset', generatedPassword: false, answers };
  }
}

async function gatherAnswers(context: CommandContext): Promise<ConfigureResult> {
  ensureServerEnvFile();
  const acceptDefaults = hasFlag(context.args, '--yes', '--accept-defaults');
  const storedLang = context.lang ?? readCliMeta().language ?? getCurrentLanguage();
  const lang = await chooseLanguage(storedLang, acceptDefaults);
  printBanner(lang, text(lang, 'title'));

  if (rootEnvExists()) {
    printStatus('warn', text(lang, 'invalidRootEnv'));
  }

  const forcedMode = hasFlag(context.args, '--quickstart')
    ? 'quickstart'
    : hasFlag(context.args, '--advanced')
      ? 'advanced'
      : undefined;
  const forcedSection = validateRequestedSection(readOption(context.args, '--section'));
  const { mode, section } = await chooseConfigureMode(lang, forcedMode, forcedSection, acceptDefaults);

  const env = parseEnvFile();
  const cliMeta = readCliMeta();
  const existingReachability = cliMeta.reachability ?? inferReachability(env, 'local');
  const existingPurpose = cliMeta.purpose ?? ((env.URUC_PURPOSE === 'production' ? 'production' : 'test') as InstancePurpose);

  const currentBaseUrl = env.BASE_URL;
  const baseHost = existingReachability === 'local'
    ? '127.0.0.1'
    : existingReachability === 'lan'
      ? safeHostFromBaseUrl(currentBaseUrl, detectLanHost())
      : safeHostFromBaseUrl(currentBaseUrl, os.hostname());
  const baseProtocol = existingReachability === 'server'
    ? inferSiteProtocol(currentBaseUrl, 'http')
    : 'http';
  const defaults = currentConfigureDefaults(
    existingReachability,
    existingPurpose,
    baseHost,
    env.PORT ?? '3000',
    env.WS_PORT ?? '3001',
    baseProtocol,
  );

  const initialCityConfigPath = resolveCityConfigPath(defaults.cityConfigPath);
  const cityConfigExists = existsSync(initialCityConfigPath);
  const existingCityConfig = await readCityConfig(initialCityConfigPath);
  const existingPluginState = cityConfigExists
    ? detectBundledPluginState(existingCityConfig)
    : getBundledPluginPresetState(DEFAULT_PLUGIN_PRESET);
  const existingPluginPreset = cityConfigExists
    ? inferPluginPreset(existingPluginState)
    : DEFAULT_PLUGIN_PRESET;

  let cityConfigResolvedPath = initialCityConfigPath;
  let baseCityConfig = cityConfigExists
    ? existingCityConfig
    : {
      apiVersion: 2,
      approvedPublishers: ['uruc'],
      pluginStoreDir: DEFAULT_PLUGIN_STORE_DIR,
      sources: [],
      plugins: {},
    } satisfies CityConfigFile;

  const answers: ConfigureAnswers = {
    ...defaults,
    lang,
    mode,
    section,
    reachability: existingReachability,
    purpose: existingPurpose,
    pluginPreset: existingPluginPreset,
    pluginStoreDir: existingCityConfig.pluginStoreDir ?? DEFAULT_PLUGIN_STORE_DIR,
    bundledPluginState: existingPluginState,
  };

  if (mode === 'quickstart' || sectionMatches(section, 'runtime')) {
    if (!acceptDefaults) {
      answers.reachability = await promptChoice<CityReachability>(
        text(lang, 'reachabilityPrompt'),
        [
          { value: 'local', label: text(lang, 'localMode'), description: text(lang, 'localModeDesc') },
          { value: 'lan', label: text(lang, 'lanMode'), description: text(lang, 'lanModeDesc') },
          { value: 'server', label: text(lang, 'serverMode'), description: text(lang, 'serverModeDesc') },
        ],
        answers.reachability,
        lang,
      );

      answers.purpose = await promptChoice<InstancePurpose>(
        text(lang, 'purposePrompt'),
        [
          { value: 'test', label: lang === 'zh-CN' ? '测试' : lang === 'en' ? 'Test' : '테스트' },
          { value: 'production', label: lang === 'zh-CN' ? '正式' : lang === 'en' ? 'Production' : '운영' },
        ],
        answers.purpose,
        lang,
      );
    }

    const runtimeDefaults = defaultConfig(
      answers.reachability,
      answers.purpose,
      answers.publicHost,
      answers.httpPort,
      answers.wsPort,
      answers.siteProtocol,
    );
    const suggestedPublicHost = answers.reachability === 'local'
      ? '127.0.0.1'
      : answers.reachability === 'lan'
        ? safeHostFromBaseUrl(currentBaseUrl, detectLanHost())
        : safeHostFromBaseUrl(currentBaseUrl, os.hostname());

    answers.publicHost = answers.reachability === 'local'
      ? '127.0.0.1'
      : acceptDefaults
        ? (answers.publicHost || suggestedPublicHost)
        : await promptInput(
          answers.reachability === 'lan' ? text(lang, 'lanHostPrompt') : text(lang, 'serverHostPrompt'),
          answers.publicHost || suggestedPublicHost,
        );

    if (answers.reachability === 'server') {
      if (!acceptDefaults) {
        answers.siteProtocol = await promptChoice<SiteProtocol>(
          text(lang, 'protocolPrompt'),
          [
            { value: 'http', label: text(lang, 'protocolHttp') },
            { value: 'https', label: text(lang, 'protocolHttps') },
          ],
          answers.siteProtocol,
          lang,
        );
      }
    } else {
      answers.siteProtocol = 'http';
    }

    if (mode === 'advanced' && !acceptDefaults) {
      answers.httpPort = await promptInput(text(lang, 'httpPortPrompt'), answers.httpPort);
      answers.wsPort = await promptInput(text(lang, 'wsPortPrompt'), answers.wsPort);
      answers.publicDir = await promptInput(text(lang, 'publicDirPrompt'), answers.publicDir || runtimeDefaults.publicDir);
      answers.uploadsDir = await promptInput(text(lang, 'uploadsDirPrompt'), answers.uploadsDir || runtimeDefaults.uploadsDir);
    } else {
      answers.httpPort = answers.httpPort || '3000';
      answers.wsPort = answers.wsPort || '3001';
      answers.publicDir = keepConfiguredPath(answers.publicDir, runtimeDefaults.publicDir);
      answers.uploadsDir = keepConfiguredPath(answers.uploadsDir, runtimeDefaults.uploadsDir);
    }

    answers.bindHost = defaultBindHost(answers.reachability);
    answers.baseUrl = buildBaseUrl(answers.siteProtocol, answers.publicHost, answers.httpPort);
    answers.allowRegister = mode === 'quickstart' ? runtimeDefaults.allowRegister : answers.allowRegister;
    answers.noindex = mode === 'quickstart' ? runtimeDefaults.noindex : answers.noindex;
    answers.allowedOrigins = mode === 'quickstart'
      ? defaultConfig(
        answers.reachability,
        answers.purpose,
        answers.publicHost,
        answers.httpPort,
        answers.wsPort,
        answers.siteProtocol,
      ).allowedOrigins
      : answers.allowedOrigins;
  }

  if (mode === 'quickstart' || sectionMatches(section, 'access')) {
    if (!acceptDefaults) {
      answers.adminUsername = await promptInput(text(lang, 'adminUserPrompt'), answers.adminUsername);
      answers.adminPassword = await promptInput(text(lang, 'adminPasswordPrompt'), answers.adminPassword, { secret: true });
      answers.adminEmail = await promptInput(text(lang, 'adminEmailPrompt'), answers.adminEmail);
    }

    if (mode === 'advanced' && !acceptDefaults) {
      answers.allowRegister = await promptConfirm(text(lang, 'allowRegisterPrompt'), answers.allowRegister, lang);
      answers.noindex = await promptConfirm(text(lang, 'noindexPrompt'), answers.noindex, lang);
      answers.sitePassword = await promptInput(text(lang, 'sitePasswordPrompt'), answers.sitePassword, {
        secret: true,
        clearTokens: ['-'],
        clearHint: sitePasswordClearHint(lang),
      });
    }
  }

  if (sectionMatches(section, 'city') && mode === 'advanced') {
    answers.dbPath = await promptInput(text(lang, 'dbPathPrompt'), answers.dbPath);
    const nextCityConfigPath = await promptInput(text(lang, 'cityConfigPrompt'), answers.cityConfigPath);
    const nextResolved = resolveCityConfigPath(nextCityConfigPath);
    if (nextResolved !== cityConfigResolvedPath) {
      baseCityConfig = rebaseCityConfigPaths(baseCityConfig, cityConfigResolvedPath, nextResolved);
      cityConfigResolvedPath = nextResolved;
    }
    answers.cityConfigPath = nextCityConfigPath;
  } else if (mode === 'quickstart') {
    answers.dbPath = keepConfiguredPath(
      answers.dbPath,
      defaultConfig(
        answers.reachability,
        answers.purpose,
        answers.publicHost,
        answers.httpPort,
        answers.wsPort,
        answers.siteProtocol,
      ).dbPath,
    );
  }

  if (mode === 'quickstart' || sectionMatches(section, 'plugins')) {
    if (mode === 'advanced') {
      const nextCityConfigPath = await promptInput(text(lang, 'cityConfigPrompt'), answers.cityConfigPath);
      const nextResolved = resolveCityConfigPath(nextCityConfigPath);
      if (nextResolved !== cityConfigResolvedPath) {
        baseCityConfig = rebaseCityConfigPaths(baseCityConfig, cityConfigResolvedPath, nextResolved);
        cityConfigResolvedPath = nextResolved;
      }
      answers.cityConfigPath = nextCityConfigPath;
      answers.pluginStoreDir = await promptInput(text(lang, 'pluginStoreDirPrompt'), answers.pluginStoreDir || DEFAULT_PLUGIN_STORE_DIR);
    }

    if (!acceptDefaults) {
      answers.pluginPreset = await choosePluginPreset(lang, answers.pluginPreset);
      answers.bundledPluginState = answers.pluginPreset === 'custom'
        ? await chooseCustomBundledPlugins(lang, answers.bundledPluginState)
        : getBundledPluginPresetState(answers.pluginPreset, answers.bundledPluginState);
    } else {
      answers.bundledPluginState = getBundledPluginPresetState(answers.pluginPreset, answers.bundledPluginState);
    }

    if (mode === 'advanced' && await promptConfirm(text(lang, 'editSourcesPrompt'), false, lang)) {
      baseCityConfig = {
        ...baseCityConfig,
        sources: await editSources(lang, baseCityConfig.sources ?? []),
      };
    }
  }

  if (sectionMatches(section, 'integrations') && mode === 'advanced') {
    answers.allowedOrigins = await promptInput(text(lang, 'allowedOriginsPrompt'), answers.allowedOrigins);
    answers.jwtSecret = await promptInput(text(lang, 'jwtSecretPrompt'), answers.jwtSecret);

    const useResend = await promptConfirm(text(lang, 'resendPrompt'), !!answers.resendApiKey, lang);
    if (useResend) {
      answers.resendApiKey = await promptInput(text(lang, 'resendKeyPrompt'), answers.resendApiKey);
      answers.fromEmail = await promptInput(text(lang, 'fromEmailPrompt'), answers.fromEmail);
    } else {
      answers.resendApiKey = '';
      answers.fromEmail = '';
    }

    const useGoogle = await promptConfirm(text(lang, 'googlePrompt'), !!answers.googleClientId, lang);
    if (useGoogle) {
      answers.googleClientId = await promptInput(text(lang, 'googleIdPrompt'), answers.googleClientId);
      answers.googleClientSecret = await promptInput(text(lang, 'googleSecretPrompt'), answers.googleClientSecret, { secret: true });
    } else {
      answers.googleClientId = '';
      answers.googleClientSecret = '';
    }

    const useGithub = await promptConfirm(text(lang, 'githubPrompt'), !!answers.githubClientId, lang);
    if (useGithub) {
      answers.githubClientId = await promptInput(text(lang, 'githubIdPrompt'), answers.githubClientId);
      answers.githubClientSecret = await promptInput(text(lang, 'githubSecretPrompt'), answers.githubClientSecret, { secret: true });
    } else {
      answers.githubClientId = '';
      answers.githubClientSecret = '';
    }
  }

  const adminResolution = await reconcileAdminAccount(answers, lang, acceptDefaults);
  return {
    answers: adminResolution.answers,
    adminAction: adminResolution.action,
    generatedPassword: adminResolution.generatedPassword,
    baseCityConfig,
    cityConfigResolvedPath,
  };
}

async function applyAdminPlan(result: ConfigureResult): Promise<void> {
  if (result.adminAction === 'keep') return;
  if (result.adminAction === 'reset') {
    await resetAdminPassword(result.answers.adminUsername, result.answers.adminPassword, result.answers.dbPath);
    return;
  }

  const created = await createAdmin(
    result.answers.adminUsername,
    result.answers.adminPassword,
    result.answers.adminEmail,
    result.answers.dbPath,
  );
  if (!created.created) {
    throw new Error(created.reason ?? `Failed to create admin ${result.answers.adminUsername}`);
  }
}

async function persistConfiguration(result: ConfigureResult): Promise<void> {
  writeEnvFile(configureAnswersToEnv(result.answers));
  rememberConfiguration(result.answers);
  await ensureCityConfig({
    configPath: result.cityConfigResolvedPath,
    packageRoot,
    preset: result.answers.pluginPreset,
    pluginState: result.answers.bundledPluginState,
    pluginStoreDir: result.answers.pluginStoreDir || DEFAULT_PLUGIN_STORE_DIR,
    baseConfig: result.baseCityConfig,
    createIfMissing: true,
    mutateExisting: true,
  });
  await syncCityLock({
    configPath: result.cityConfigResolvedPath,
    lockPath: getCityLockPath(),
    packageRoot,
    pluginStoreDir: path.isAbsolute(result.answers.pluginStoreDir)
      ? result.answers.pluginStoreDir
      : path.resolve(packageRoot, result.answers.pluginStoreDir || DEFAULT_PLUGIN_STORE_DIR),
  });
}

function printSummary(result: ConfigureResult): void {
  const { answers } = result;
  const lang = answers.lang;
  const summary = getConfigureSummaryLines(answers);

  printSection(text(lang, 'summaryTitle'));

  printSection(text(lang, 'runtimeSummaryTitle'));
  for (const line of summary.slice(0, 6)) {
    console.log(`- ${line}`);
  }

  printSection(text(lang, 'citySummaryTitle'));
  for (const line of summary.slice(10, 16)) {
    console.log(`- ${line}`);
  }

  printSection(text(lang, 'adminSummaryTitle'));
  for (const line of summary.slice(6, 10)) {
    console.log(`- ${line}`);
  }
  console.log(`- Email: ${answers.adminEmail}`);
  console.log(`- ${text(lang, 'sourcesSummary')}: ${result.baseCityConfig.sources?.length ?? 0}`);

  if (result.generatedPassword) {
    printStatus('info', text(lang, 'generatedPassword'));
  }
  if (answers.siteProtocol === 'https') {
    printStatus('warn', text(lang, 'httpsNotice'));
  }
}

export async function runConfigureCommand(context: CommandContext): Promise<void> {
  const result = await gatherAnswers(context);
  const { answers } = result;
  const lang = answers.lang;
  const acceptDefaults = hasFlag(context.args, '--yes', '--accept-defaults');

  printSummary(result);

  printSection(text(lang, 'actionsTitle'));
  for (const action of getConfigureActions()) {
    console.log(`- ${action}`);
  }

  const runtimeStatus = await getRuntimeStatus();
  const systemdInstalled = isSystemdInstalled();
  const applyChoices = getApplyChoices(lang, runtimeStatus, systemdInstalled);
  if (runtimeStatus.mode === 'unmanaged') {
    printStatus('warn', unmanagedSaveWarning(lang));
  }

  const nextAction = acceptDefaults
    ? 'save'
    : await promptChoice<ConfigureApplyAction>(
      text(lang, 'applyPrompt'),
      applyChoices,
      applyChoices[0]?.value ?? 'save',
      lang,
    );

  if (nextAction === 'edit') {
    await runConfigureCommand(context);
    return;
  }

  await applyAdminPlan(result);
  await persistConfiguration(result);

  const siteUrl = answers.baseUrl;
  const wsUrl = buildPublicWsUrl(siteUrl, answers.wsPort);

  if (nextAction === 'save') {
    printSection(text(lang, 'finishedTitle'));
    console.log(text(lang, 'savedOnly'));
    console.log(`Site: ${siteUrl}`);
    console.log(`WS:   ${wsUrl}`);
    if (result.generatedPassword) {
      console.log(`Admin: ${answers.adminUsername}`);
      console.log(`Password: ${answers.adminPassword}`);
    }
    return;
  }

  if (nextAction === 'start-managed') {
    const currentRuntime = await getRuntimeStatus();
    if (currentRuntime.mode === 'background' || currentRuntime.mode === 'systemd') {
      const { runRestartCommand } = await import('./restart.js');
      await runRestartCommand({ ...context, args: [] });
      return;
    }

    const { runStartCommand } = await import('./start.js');
    await runStartCommand({
      ...context,
      args: ['--background'],
    });
    return;
  }

  const { runStartCommand } = await import('./start.js');
  await runStartCommand({ ...context, args: [] });
}
