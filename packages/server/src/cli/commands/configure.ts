import os from 'os';

import {
  adminExists,
  createAdmin,
  getUserRole,
  resolveAdminPasswordState,
  resetAdminPassword,
} from '../lib/admin.js';
import {
  buildBaseUrl,
  configureAnswersToEnv,
  currentConfigureDefaults,
  ensureServerEnvFile,
  getCurrentLanguage,
  getDefaultPluginConfig,
  inferReachability,
  inferSiteProtocol,
  parseEnvFile,
  rootEnvExists,
  writeEnvFile,
} from '../lib/env.js';
import {
  getConfigureActions,
  getConfigureSummaryLines,
  rememberConfiguration,
} from '../lib/configure.js';
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
import type {
  CityReachability,
  CommandContext,
  ConfigureAnswers,
  InstancePurpose,
  SiteProtocol,
  UiLanguage,
} from '../lib/types.js';

interface ConfigureResult {
  answers: ConfigureAnswers;
  adminAction: 'create' | 'keep' | 'reset';
  generatedPassword: boolean;
}

const copy = {
  'zh-CN': {
    title: 'Configure',
    invalidRootEnv: '检测到仓库根目录 .env：当前 CLI 不会读取它，真正生效的是 packages/server/.env。',
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
    advancedPrompt: '是否配置高级项？（数据库、插件、跨域、JWT、邮件、OAuth）',
    dbPathPrompt: '数据库路径',
    pluginConfigPrompt: '插件配置文件路径',
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
    existingAdminPrompt: '这个管理员用户名已经存在，你想怎么处理？',
    existingUserPrompt: '这个用户名已经存在，但它不是管理员。请改用新用户名，或稍后用 `uruc admin promote`。',
    keepAdmin: '保持现有账号不变',
    resetAdmin: '重置该账号密码',
    renameAdmin: '换一个新的管理员用户名',
    keepPasswordPrompt: '请输入现有管理员密码（用于验证）',
    summaryTitle: '城市配置摘要',
    actionsTitle: '即将执行',
    applyPrompt: '配置完成后怎么处理？',
    startForeground: '保存并前台启动',
    startBackground: '保存并后台启动',
    saveOnly: '只保存配置',
    editAgain: '返回修改',
    generatedPassword: '管理员密码未输入，已自动生成。',
    finishedTitle: '完成',
    savedOnly: '配置已保存。稍后可运行 `uruc start` 启动。',
    httpsNotice: '你选择了 HTTPS 分享地址。Uruc 不会自动配置证书或反向代理；如需真正对外 HTTPS，请自行接入 TLS。',
  },
  en: {
    title: 'Configure',
    invalidRootEnv: 'A repo-root .env was found. Uruc ignores it; only packages/server/.env is active.',
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
    advancedPrompt: 'Configure advanced settings? (DB, plugins, CORS, JWT, mail, OAuth)',
    dbPathPrompt: 'Database path',
    pluginConfigPrompt: 'Plugin config path',
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
    existingAdminPrompt: 'This admin username already exists. How should configure handle it?',
    existingUserPrompt: 'This username already exists but is not an admin. Pick a new username or promote it later with `uruc admin promote`.',
    keepAdmin: 'Keep the existing admin account',
    resetAdmin: 'Reset that admin password',
    renameAdmin: 'Choose a new admin username',
    keepPasswordPrompt: 'Enter the current admin password for verification',
    summaryTitle: 'City configuration summary',
    actionsTitle: 'Planned actions',
    applyPrompt: 'What should Uruc do next?',
    startForeground: 'Save and start in foreground',
    startBackground: 'Save and start in background',
    saveOnly: 'Save config only',
    editAgain: 'Go back and edit',
    generatedPassword: 'No admin password was entered, so Uruc generated one.',
    finishedTitle: 'Done',
    savedOnly: 'Configuration saved. Run `uruc start` later when you want the city online.',
    httpsNotice: 'You chose an HTTPS share URL. Uruc will not provision certificates or a reverse proxy; you must handle TLS yourself.',
  },
  ko: {
    title: 'Configure',
    invalidRootEnv: '저장소 루트의 .env 가 감지되었습니다. Uruc 는 이를 무시하며 packages/server/.env 만 사용합니다.',
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
    advancedPrompt: '고급 설정을 구성하시겠습니까? (DB, 플러그인, CORS, JWT, 메일, OAuth)',
    dbPathPrompt: '데이터베이스 경로',
    pluginConfigPrompt: '플러그인 설정 파일 경로',
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
    existingAdminPrompt: '이 관리자 사용자명이 이미 존재합니다. 어떻게 처리하시겠습니까?',
    existingUserPrompt: '이 사용자명은 존재하지만 관리자가 아닙니다. 새 이름을 쓰거나 나중에 `uruc admin promote` 를 사용하세요.',
    keepAdmin: '기존 관리자 계정 유지',
    resetAdmin: '해당 관리자 비밀번호 재설정',
    renameAdmin: '새 관리자 사용자명 선택',
    keepPasswordPrompt: '검증을 위해 현재 관리자 비밀번호를 입력하세요',
    summaryTitle: '도시 설정 요약',
    actionsTitle: '실행 예정 작업',
    applyPrompt: '다음으로 무엇을 할까요?',
    startForeground: '저장 후 포그라운드 시작',
    startBackground: '저장 후 백그라운드 시작',
    saveOnly: '설정만 저장',
    editAgain: '다시 수정',
    generatedPassword: '관리자 비밀번호가 비어 있어 Uruc가 자동 생성했습니다.',
    finishedTitle: '완료',
    savedOnly: '설정을 저장했습니다. 나중에 `uruc start` 로 도시를 시작하세요.',
    httpsNotice: 'HTTPS 공유 주소를 선택했습니다. Uruc 는 인증서나 리버스 프록시를 자동 구성하지 않으므로 TLS 는 직접 처리해야 합니다.',
  },
} as const;

function text(lang: UiLanguage, key: keyof typeof copy['zh-CN']): string {
  return copy[lang][key];
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

async function chooseLanguage(defaultLang: UiLanguage): Promise<UiLanguage> {
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

async function reconcileAdminAccount(
  answers: ConfigureAnswers,
  lang: UiLanguage,
): Promise<{ action: 'create' | 'keep' | 'reset'; generatedPassword: boolean; answers: ConfigureAnswers }> {
  let generatedPassword = false;

  while (true) {
    const role = await getUserRole(answers.adminUsername, answers.dbPath);
    if (role && role !== 'admin') {
      printStatus('warn', text(lang, 'existingUserPrompt'));
      answers.adminUsername = await promptInput(text(lang, 'adminUserPrompt'), `${answers.adminUsername}-admin`);
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
  const storedLang = context.lang ?? readCliMeta().language ?? getCurrentLanguage();
  const lang = await chooseLanguage(storedLang);
  printBanner(lang, text(lang, 'title'));

  if (rootEnvExists()) {
    printStatus('warn', text(lang, 'invalidRootEnv'));
  }

  const env = parseEnvFile();
  const cliMeta = readCliMeta();
  const existingReachability = cliMeta.reachability ?? inferReachability(env, 'local');
  const existingPurpose = cliMeta.purpose ?? ((env.URUC_PURPOSE === 'production' ? 'production' : 'test') as InstancePurpose);

  const reachability = await promptChoice<CityReachability>(
    text(lang, 'reachabilityPrompt'),
    [
      { value: 'local', label: text(lang, 'localMode'), description: text(lang, 'localModeDesc') },
      { value: 'lan', label: text(lang, 'lanMode'), description: text(lang, 'lanModeDesc') },
      { value: 'server', label: text(lang, 'serverMode'), description: text(lang, 'serverModeDesc') },
    ],
    existingReachability,
    lang,
  );

  const purpose = await promptChoice<InstancePurpose>(
    text(lang, 'purposePrompt'),
    [
      { value: 'test', label: lang === 'zh-CN' ? '测试' : lang === 'en' ? 'Test' : '테스트' },
      { value: 'production', label: lang === 'zh-CN' ? '正式' : lang === 'en' ? 'Production' : '운영' },
    ],
    existingPurpose,
    lang,
  );

  const currentBaseUrl = env.BASE_URL;
  const defaultPublicHost = reachability === 'local'
    ? '127.0.0.1'
    : reachability === 'lan'
      ? safeHostFromBaseUrl(currentBaseUrl, detectLanHost())
      : safeHostFromBaseUrl(currentBaseUrl, os.hostname());
  const defaultProtocol = reachability === 'server'
    ? inferSiteProtocol(currentBaseUrl, 'http')
    : 'http';

  const publicHost = reachability === 'local'
    ? '127.0.0.1'
    : await promptInput(
      reachability === 'lan' ? text(lang, 'lanHostPrompt') : text(lang, 'serverHostPrompt'),
      defaultPublicHost,
    );
  const siteProtocol = reachability === 'server'
    ? await promptChoice<SiteProtocol>(
      text(lang, 'protocolPrompt'),
      [
        { value: 'http', label: text(lang, 'protocolHttp') },
        { value: 'https', label: text(lang, 'protocolHttps') },
      ],
      defaultProtocol,
      lang,
    )
    : 'http';
  const httpPort = await promptInput(text(lang, 'httpPortPrompt'), env.PORT ?? '3000');
  const wsPort = await promptInput(text(lang, 'wsPortPrompt'), env.WS_PORT ?? '3001');
  const defaults = currentConfigureDefaults(reachability, purpose, publicHost, httpPort, wsPort, siteProtocol);

  const adminUsername = await promptInput(text(lang, 'adminUserPrompt'), defaults.adminUsername);
  const adminPassword = await promptInput(text(lang, 'adminPasswordPrompt'), defaults.adminPassword, { secret: true });
  const adminEmail = await promptInput(text(lang, 'adminEmailPrompt'), defaults.adminEmail);
  const allowRegister = await promptConfirm(text(lang, 'allowRegisterPrompt'), defaults.allowRegister, lang);
  const noindex = await promptConfirm(text(lang, 'noindexPrompt'), defaults.noindex, lang);
  const sitePassword = await promptInput(text(lang, 'sitePasswordPrompt'), defaults.sitePassword, { secret: true });

  const answers: ConfigureAnswers = {
    ...defaults,
    lang,
    reachability,
    purpose,
    bindHost: defaults.bindHost,
    publicHost,
    siteProtocol,
    httpPort,
    wsPort,
    adminUsername,
    adminPassword,
    adminEmail,
    allowRegister,
    noindex,
    sitePassword,
    baseUrl: buildBaseUrl(siteProtocol, publicHost, httpPort),
  };

  const advanced = await promptConfirm(text(lang, 'advancedPrompt'), false, lang);
  if (advanced) {
    answers.dbPath = await promptInput(text(lang, 'dbPathPrompt'), defaults.dbPath);
    answers.pluginConfigPath = await promptInput(text(lang, 'pluginConfigPrompt'), defaults.pluginConfigPath || getDefaultPluginConfig(purpose));
    answers.allowedOrigins = await promptInput(text(lang, 'allowedOriginsPrompt'), defaults.allowedOrigins);
    answers.jwtSecret = await promptInput(text(lang, 'jwtSecretPrompt'), defaults.jwtSecret);
    answers.publicDir = await promptInput(text(lang, 'publicDirPrompt'), defaults.publicDir);
    answers.uploadsDir = await promptInput(text(lang, 'uploadsDirPrompt'), defaults.uploadsDir);

    const useResend = await promptConfirm(text(lang, 'resendPrompt'), !!defaults.resendApiKey, lang);
    if (useResend) {
      answers.resendApiKey = await promptInput(text(lang, 'resendKeyPrompt'), defaults.resendApiKey);
      answers.fromEmail = await promptInput(text(lang, 'fromEmailPrompt'), defaults.fromEmail);
    } else {
      answers.resendApiKey = '';
    }

    const useGoogle = await promptConfirm(text(lang, 'googlePrompt'), !!defaults.googleClientId, lang);
    if (useGoogle) {
      answers.googleClientId = await promptInput(text(lang, 'googleIdPrompt'), defaults.googleClientId);
      answers.googleClientSecret = await promptInput(text(lang, 'googleSecretPrompt'), defaults.googleClientSecret, { secret: true });
    } else {
      answers.googleClientId = '';
      answers.googleClientSecret = '';
    }

    const useGithub = await promptConfirm(text(lang, 'githubPrompt'), !!defaults.githubClientId, lang);
    if (useGithub) {
      answers.githubClientId = await promptInput(text(lang, 'githubIdPrompt'), defaults.githubClientId);
      answers.githubClientSecret = await promptInput(text(lang, 'githubSecretPrompt'), defaults.githubClientSecret, { secret: true });
    } else {
      answers.githubClientId = '';
      answers.githubClientSecret = '';
    }
  }

  const adminResolution = await reconcileAdminAccount(answers, lang);
  return {
    answers: adminResolution.answers,
    adminAction: adminResolution.action,
    generatedPassword: adminResolution.generatedPassword,
  };
}

async function applyAdminPlan(result: ConfigureResult): Promise<void> {
  if (result.adminAction === 'keep') return;
  if (result.adminAction === 'reset') {
    await resetAdminPassword(result.answers.adminUsername, result.answers.adminPassword);
    return;
  }

  const created = await createAdmin(result.answers.adminUsername, result.answers.adminPassword, result.answers.adminEmail);
  if (!created.created) {
    throw new Error(created.reason ?? `Failed to create admin ${result.answers.adminUsername}`);
  }
}

function persistConfiguration(result: ConfigureResult): void {
  writeEnvFile(configureAnswersToEnv(result.answers));
  rememberConfiguration(result.answers);
}

export async function runConfigureCommand(context: CommandContext): Promise<void> {
  const result = await gatherAnswers(context);
  const { answers } = result;
  const lang = answers.lang;

  printSection(text(lang, 'summaryTitle'));
  for (const line of getConfigureSummaryLines(answers)) {
    console.log(`- ${line}`);
  }
  if (result.generatedPassword) {
    printStatus('info', text(lang, 'generatedPassword'));
  }
  if (answers.siteProtocol === 'https') {
    printStatus('warn', text(lang, 'httpsNotice'));
  }

  printSection(text(lang, 'actionsTitle'));
  for (const action of getConfigureActions()) {
    console.log(`- ${action}`);
  }

  const nextAction = await promptChoice(
    text(lang, 'applyPrompt'),
    [
      { value: 'start-foreground', label: text(lang, 'startForeground') },
      { value: 'start-background', label: text(lang, 'startBackground') },
      { value: 'save', label: text(lang, 'saveOnly') },
      { value: 'edit', label: text(lang, 'editAgain') },
    ],
    'start-foreground',
    lang,
  );

  if (nextAction === 'edit') {
    await runConfigureCommand(context);
    return;
  }

  persistConfiguration(result);
  await applyAdminPlan(result);

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

  const { runStartCommand } = await import('./start.js');
  await runStartCommand({
    ...context,
    args: nextAction === 'start-background' ? ['--background'] : [],
  });
}
