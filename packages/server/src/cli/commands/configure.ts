import os from 'os';

import {
  adminExists,
  assignUserEmail,
  clearUserEmail,
  createAdmin,
  findUserByEmail,
  getUserRole,
  resolveAdminPasswordState,
  resetAdminPassword,
} from '../lib/admin.js';
import {
  buildBaseUrl,
  buildSiteUrl,
  configureAnswersToEnv,
  currentConfigureDefaults,
  defaultBindHostForExposure,
  ensureServerEnvFile,
  getCurrentLanguage,
  getDefaultPluginConfig,
  legacyDeploymentModeToExposure,
  parseEnvFile,
  rootEnvExists,
  writeEnvFile,
  defaultConfig,
} from '../lib/env.js';
import { getConfigureActions, getConfigureSummaryLines } from '../lib/configure-plan.js';
import { readCliMeta, writeCliMeta } from '../lib/state.js';
import {
  printBanner,
  printSection,
  printStatus,
  promptChoice,
  promptConfirm,
  promptInput,
} from '../lib/ui.js';
import type {
  CommandContext,
  ConfigureAnswers,
  ExposureMode,
  InstancePurpose,
  UiLanguage,
} from '../lib/types.js';

interface ConfigureResult {
  answers: ConfigureAnswers;
  adminAction: 'create' | 'keep' | 'reset';
  generatedPassword: boolean;
  emailTransferFromUsername?: string;
}

const copy = {
  'zh-CN': {
    configureTitle: 'Configure',
    invalidRootEnv: '检测到仓库根目录 .env：当前 CLI 不会读取它，真正生效的是 packages/server/.env。',
    languagePrompt: '请选择语言',
    exposurePrompt: '谁能访问这座城市？',
    purposePrompt: '这个 city 的用途是什么？',
    lanHostPrompt: '局域网访问地址（通常填当前机器的内网 IP）',
    publicHostPrompt: '公网访问主机（填域名或公网 IP）',
    httpsPrompt: '公网入口是否使用 HTTPS？',
    httpPortPrompt: 'HTTP 端口',
    wsPortPrompt: 'WebSocket 端口',
    adminUserPrompt: '管理员用户名',
    adminPasswordPrompt: '管理员密码',
    adminEmailPrompt: '管理员邮箱',
    allowRegisterPrompt: '是否开放注册？',
    noindexPrompt: '是否禁止搜索引擎收录？',
    sitePasswordPrompt: '站点访问密码（可选）',
    advancedPrompt: '是否配置高级项？',
    bindHostPrompt: '高级：运行时绑定地址（本机常用 127.0.0.1；局域网或服务器常用 0.0.0.0）',
    advancedHostPrompt: '高级：对外访问主机（BASE_URL 使用的主机名或 IP）',
    advancedHttpsPrompt: '高级：BASE_URL 是否使用 HTTPS？',
    dbPathPrompt: '数据库路径',
    pluginConfigPrompt: '插件配置文件路径',
    allowedOriginsPrompt: '允许访问 API 的前端地址（逗号分隔）',
    jwtSecretPrompt: 'JWT 密钥',
    basePathPrompt: 'City 路径（例如 /app，留空表示根路径）',
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
    existingEmailPrompt: '这个邮箱已经被用户 {username} 使用。请换一个邮箱，或改用那个账号。',
    existingEmailActionPrompt: '这个邮箱冲突要怎么处理？',
    changeEmail: '换一个邮箱',
    reassignEmail: '覆盖并迁移到当前管理员',
    reassignEmailConfirm: '确认把邮箱 {email} 从 {username} 迁移到当前管理员？',
    keepAdmin: '保持现有账号不变',
    resetAdmin: '重置该账号密码',
    renameAdmin: '换一个新的管理员用户名',
    keepPasswordPrompt: '请输入现有管理员密码（用于验证）',
    applyPrompt: '选择下一步',
    applyNow: '写入配置并同步管理员',
    editAgain: '返回修改',
    summaryTitle: '配置摘要',
    actionsTitle: '即将执行',
    finishedTitle: '完成',
    generatedPassword: '管理员密码未输入，已自动生成。',
    configureSaved: 'City runtime 配置已保存。',
    localOnly: '仅本机（127.0.0.1）',
    lanShare: '局域网共享（同一内网）',
    directPublic: '公网可访问（域名 / 公网 IP）',
    test: '测试',
    production: '正式',
  },
  en: {
    configureTitle: 'Configure',
    invalidRootEnv: 'A repo-root .env was found. Uruc ignores it; only packages/server/.env is active.',
    languagePrompt: 'Choose language',
    exposurePrompt: 'What access scope should this city have?',
    purposePrompt: 'What is this city for?',
    lanHostPrompt: 'LAN address others should use to reach this machine',
    publicHostPrompt: 'Public host for this city (domain or public IP)',
    httpsPrompt: 'Should the public entry use HTTPS?',
    httpPortPrompt: 'HTTP port',
    wsPortPrompt: 'WebSocket port',
    adminUserPrompt: 'Admin username',
    adminPasswordPrompt: 'Admin password',
    adminEmailPrompt: 'Admin email',
    allowRegisterPrompt: 'Allow public registration?',
    noindexPrompt: 'Block search engine indexing?',
    sitePasswordPrompt: 'Site access password (optional)',
    advancedPrompt: 'Configure advanced settings?',
    bindHostPrompt: 'Advanced: runtime bind host (127.0.0.1 for local-only, 0.0.0.0 for LAN/server)',
    advancedHostPrompt: 'Advanced: public host used in BASE_URL',
    advancedHttpsPrompt: 'Advanced: should BASE_URL use HTTPS?',
    dbPathPrompt: 'Database path',
    pluginConfigPrompt: 'Plugin config path',
    allowedOriginsPrompt: 'Allowed frontend origins (comma-separated)',
    jwtSecretPrompt: 'JWT secret',
    basePathPrompt: 'City path (for example /app; leave blank for /)',
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
    existingEmailPrompt: 'This email is already used by {username}. Pick a different email or reuse that account.',
    existingEmailActionPrompt: 'How should this email conflict be handled?',
    changeEmail: 'Use another email',
    reassignEmail: 'Reassign it to this admin',
    reassignEmailConfirm: 'Move {email} from {username} to the current admin?',
    keepAdmin: 'Keep the existing admin account',
    resetAdmin: 'Reset that admin password',
    renameAdmin: 'Choose a new admin username',
    keepPasswordPrompt: 'Enter the current admin password for verification',
    applyPrompt: 'Choose the next step',
    applyNow: 'Write config and sync admin state',
    editAgain: 'Go back and edit',
    summaryTitle: 'Summary',
    actionsTitle: 'Planned actions',
    finishedTitle: 'Done',
    generatedPassword: 'No admin password was entered, so Uruc generated one.',
    configureSaved: 'City runtime configuration was saved.',
    localOnly: 'Local only (127.0.0.1)',
    lanShare: 'LAN share (same network)',
    directPublic: 'Public internet (domain / public IP)',
    test: 'Test',
    production: 'Production',
  },
  ko: {
    configureTitle: 'Configure',
    invalidRootEnv: '저장소 루트의 .env 가 감지되었습니다. Uruc 는 이를 무시하며 packages/server/.env 만 사용합니다.',
    languagePrompt: '언어를 선택하세요',
    exposurePrompt: '이 city 의 접근 범위는 무엇입니까?',
    purposePrompt: '이 city 의 용도는 무엇입니까?',
    lanHostPrompt: 'LAN 에서 접속할 주소 (보통 현재 머신의 사설 IP)',
    publicHostPrompt: '공개 호스트 (도메인 또는 공인 IP)',
    httpsPrompt: '공개 진입점에 HTTPS 를 사용하시겠습니까?',
    httpPortPrompt: 'HTTP 포트',
    wsPortPrompt: 'WebSocket 포트',
    adminUserPrompt: '관리자 사용자명',
    adminPasswordPrompt: '관리자 비밀번호',
    adminEmailPrompt: '관리자 이메일',
    allowRegisterPrompt: '공개 가입을 허용하시겠습니까?',
    noindexPrompt: '검색 엔진 색인을 차단하시겠습니까?',
    sitePasswordPrompt: '사이트 접근 비밀번호 (선택)',
    advancedPrompt: '고급 설정을 구성하시겠습니까?',
    bindHostPrompt: '고급: 런타임 바인드 주소 (로컬 전용은 127.0.0.1, LAN/서버는 0.0.0.0)',
    advancedHostPrompt: '고급: BASE_URL 에 사용할 공개 호스트',
    advancedHttpsPrompt: '고급: BASE_URL 에 HTTPS 를 사용하시겠습니까?',
    dbPathPrompt: '데이터베이스 경로',
    pluginConfigPrompt: '플러그인 설정 파일 경로',
    allowedOriginsPrompt: '허용할 프론트엔드 origin (쉼표 구분)',
    jwtSecretPrompt: 'JWT 비밀키',
    basePathPrompt: 'City 경로 (예: /app, 루트면 비워 두기)',
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
    existingEmailPrompt: '이 이메일은 이미 {username} 사용자가 쓰고 있습니다. 다른 이메일을 입력하거나 그 계정을 사용하세요.',
    existingEmailActionPrompt: '이 이메일 충돌을 어떻게 처리하시겠습니까?',
    changeEmail: '다른 이메일 입력',
    reassignEmail: '덮어쓰고 현재 관리자에게 이전',
    reassignEmailConfirm: '{email} 을(를) {username} 에서 현재 관리자로 이전하시겠습니까?',
    keepAdmin: '기존 관리자 계정 유지',
    resetAdmin: '해당 관리자 비밀번호 재설정',
    renameAdmin: '새 관리자 사용자명 선택',
    keepPasswordPrompt: '검증을 위해 현재 관리자 비밀번호를 입력하세요',
    applyPrompt: '다음 동작을 선택하세요',
    applyNow: '설정을 저장하고 관리자 상태를 동기화',
    editAgain: '다시 수정',
    summaryTitle: '요약',
    actionsTitle: '실행 예정 작업',
    finishedTitle: '완료',
    generatedPassword: '관리자 비밀번호가 비어 있어 Uruc가 자동 생성했습니다.',
    configureSaved: 'City runtime 설정이 저장되었습니다.',
    localOnly: '로컬 전용 (127.0.0.1)',
    lanShare: 'LAN 공유 (같은 네트워크)',
    directPublic: '인터넷 공개 (도메인 / 공인 IP)',
    test: '테스트',
    production: '운영',
  },
} as const;

function text(lang: UiLanguage, key: keyof typeof copy['zh-CN']): string {
  return copy[lang][key];
}

function formatText(lang: UiLanguage, key: keyof typeof copy['zh-CN'], values: Record<string, string>): string {
  let message = text(lang, key);
  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, value);
  }
  return message;
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
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (address.address.startsWith('169.254.')) continue;
      return address.address;
    }
  }
  return os.hostname();
}

function defaultPublicHost(exposure: ExposureMode, baseUrl: string | undefined): string {
  if (exposure === 'local-only') return '127.0.0.1';
  if (exposure === 'lan-share') {
    return safeHostFromBaseUrl(baseUrl, detectLanHost());
  }
  return safeHostFromBaseUrl(baseUrl, os.hostname());
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
): Promise<{ action: 'create' | 'keep' | 'reset'; generatedPassword: boolean; answers: ConfigureAnswers; emailTransferFromUsername?: string }> {
  let generatedPassword = false;
  let emailTransferFromUsername: string | undefined;

  while (true) {
    const role = await getUserRole(answers.adminUsername, answers.dbPath);
    if (role && role !== 'admin') {
      printStatus('warn', text(lang, 'existingUserPrompt'));
      answers.adminUsername = await promptInput(text(lang, 'adminUserPrompt'), `${answers.adminUsername}-admin`);
      continue;
    }

    const userByEmail = await findUserByEmail(answers.adminEmail, answers.dbPath);
    if (userByEmail && userByEmail.username !== answers.adminUsername) {
      printStatus('warn', formatText(lang, 'existingEmailPrompt', { username: userByEmail.username }));
      const emailAction = await promptChoice(
        text(lang, 'existingEmailActionPrompt'),
        [
          { value: 'change', label: text(lang, 'changeEmail') },
          { value: 'reassign', label: text(lang, 'reassignEmail') },
        ],
        'change',
        lang,
      );

      if (emailAction === 'change') {
        answers.adminEmail = await promptInput(text(lang, 'adminEmailPrompt'), '');
        emailTransferFromUsername = undefined;
        continue;
      }

      const confirmed = await promptConfirm(
        formatText(lang, 'reassignEmailConfirm', { email: answers.adminEmail, username: userByEmail.username }),
        false,
        lang,
      );
      if (!confirmed) {
        answers.adminEmail = await promptInput(text(lang, 'adminEmailPrompt'), '');
        emailTransferFromUsername = undefined;
        continue;
      }

      emailTransferFromUsername = userByEmail.username;
    }

    const exists = await adminExists(answers.adminUsername, answers.dbPath);
    if (!exists) {
      if (!answers.adminPassword) {
        answers.adminPassword = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 24);
        generatedPassword = true;
      }
      return { action: 'create', generatedPassword, answers, emailTransferFromUsername };
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
        return { action: 'keep', generatedPassword: false, answers, emailTransferFromUsername };
      }
      printStatus('warn', `Admin password did not match the current database for ${answers.adminUsername}.`);
      answers.adminPassword = '';
      continue;
    }

    return { action: 'reset', generatedPassword: false, answers, emailTransferFromUsername };
  }
}

async function gatherAnswers(context: CommandContext): Promise<ConfigureResult> {
  ensureServerEnvFile();
  const storedLang = context.lang ?? readCliMeta().language ?? getCurrentLanguage();
  const lang = await chooseLanguage(storedLang);
  printBanner(lang, text(lang, 'configureTitle'));

  if (rootEnvExists()) {
    printStatus('warn', text(lang, 'invalidRootEnv'));
  }

  const cliMeta = readCliMeta();
  const currentEnv = parseEnvFile();
  const existingExposure = cliMeta.exposure
    ?? ((currentEnv.URUC_EXPOSURE as ExposureMode | undefined) ?? legacyDeploymentModeToExposure(cliMeta.deploymentMode ?? currentEnv.URUC_DEPLOYMENT_MODE));
  const existingPurpose = cliMeta.purpose
    ?? ((currentEnv.URUC_PURPOSE as InstancePurpose | undefined) ?? 'test');
  const exposure = await promptChoice<ExposureMode>(
    text(lang, 'exposurePrompt'),
    [
      { value: 'local-only', label: text(lang, 'localOnly') },
      { value: 'lan-share', label: text(lang, 'lanShare') },
      { value: 'direct-public', label: text(lang, 'directPublic') },
    ],
    existingExposure,
    lang,
  );

  const purpose = await promptChoice<InstancePurpose>(
    text(lang, 'purposePrompt'),
    [
      { value: 'test', label: text(lang, 'test') },
      { value: 'production', label: text(lang, 'production') },
    ],
    existingPurpose,
    lang,
  );

  const defaults = currentConfigureDefaults(
    exposure,
    purpose,
    currentEnv.BIND_HOST ?? defaultBindHostForExposure(exposure),
    defaultPublicHost(exposure, currentEnv.BASE_URL),
    currentEnv.PORT ?? '3000',
    currentEnv.WS_PORT ?? '3001',
  );

  const httpPort = await promptInput(text(lang, 'httpPortPrompt'), defaults.httpPort);
  const wsPort = await promptInput(text(lang, 'wsPortPrompt'), defaults.wsPort);
  let bindHost = defaults.bindHost;
  let publicHost = defaults.publicHost;
  let useHttps = defaults.useHttps;

  if (exposure === 'lan-share') {
    publicHost = await promptInput(text(lang, 'lanHostPrompt'), defaults.publicHost);
    useHttps = false;
  } else if (exposure === 'direct-public') {
    publicHost = await promptInput(text(lang, 'publicHostPrompt'), defaults.publicHost);
    useHttps = await promptConfirm(text(lang, 'httpsPrompt'), defaults.useHttps, lang);
  } else {
    publicHost = '127.0.0.1';
    useHttps = false;
  }

  const adminUsername = await promptInput(text(lang, 'adminUserPrompt'), defaults.adminUsername);
  const adminPassword = await promptInput(text(lang, 'adminPasswordPrompt'), defaults.adminPassword, { secret: true });
  const adminEmail = await promptInput(text(lang, 'adminEmailPrompt'), defaults.adminEmail);
  const allowRegister = await promptConfirm(text(lang, 'allowRegisterPrompt'), defaults.allowRegister, lang);
  const noindex = await promptConfirm(text(lang, 'noindexPrompt'), defaults.noindex, lang);
  const sitePassword = await promptInput(text(lang, 'sitePasswordPrompt'), defaults.sitePassword, { secret: true });

  const runtimeDefaults = defaultConfig(exposure, purpose, bindHost, publicHost, httpPort, wsPort, useHttps);
  const answers: ConfigureAnswers = {
    ...runtimeDefaults,
    dbPath: defaults.dbPath,
    pluginConfigPath: defaults.pluginConfigPath,
    allowedOrigins: currentEnv.ALLOWED_ORIGINS && currentEnv.ALLOWED_ORIGINS.trim() !== ''
      ? defaults.allowedOrigins
      : runtimeDefaults.allowedOrigins,
    jwtSecret: defaults.jwtSecret,
    appBasePath: defaults.appBasePath,
    publicDir: defaults.publicDir,
    uploadsDir: defaults.uploadsDir,
    resendApiKey: defaults.resendApiKey,
    fromEmail: defaults.fromEmail,
    googleClientId: defaults.googleClientId,
    googleClientSecret: defaults.googleClientSecret,
    githubClientId: defaults.githubClientId,
    githubClientSecret: defaults.githubClientSecret,
    lang,
    exposure,
    purpose,
    bindHost,
    publicHost,
    useHttps,
    httpPort,
    wsPort,
    adminUsername,
    adminPassword,
    adminEmail,
    allowRegister,
    noindex,
    sitePassword,
    baseUrl: buildBaseUrl(publicHost, httpPort, useHttps),
  };

  const advanced = await promptConfirm(text(lang, 'advancedPrompt'), false, lang);
  if (advanced) {
    answers.bindHost = await promptInput(text(lang, 'bindHostPrompt'), answers.bindHost);
    answers.publicHost = await promptInput(text(lang, 'advancedHostPrompt'), answers.publicHost);
    answers.useHttps = await promptConfirm(text(lang, 'advancedHttpsPrompt'), answers.useHttps, lang);
    answers.dbPath = await promptInput(text(lang, 'dbPathPrompt'), answers.dbPath);
    answers.pluginConfigPath = await promptInput(text(lang, 'pluginConfigPrompt'), answers.pluginConfigPath || getDefaultPluginConfig(purpose));
    answers.allowedOrigins = await promptInput(text(lang, 'allowedOriginsPrompt'), answers.allowedOrigins);
    answers.jwtSecret = await promptInput(text(lang, 'jwtSecretPrompt'), answers.jwtSecret);
    answers.appBasePath = await promptInput(text(lang, 'basePathPrompt'), answers.appBasePath);
    answers.publicDir = await promptInput(text(lang, 'publicDirPrompt'), answers.publicDir);
    answers.uploadsDir = await promptInput(text(lang, 'uploadsDirPrompt'), answers.uploadsDir);

    const useResend = await promptConfirm(text(lang, 'resendPrompt'), !!answers.resendApiKey, lang);
    if (useResend) {
      answers.resendApiKey = await promptInput(text(lang, 'resendKeyPrompt'), answers.resendApiKey);
      answers.fromEmail = await promptInput(text(lang, 'fromEmailPrompt'), answers.fromEmail);
    } else {
      answers.resendApiKey = '';
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

  answers.baseUrl = buildBaseUrl(answers.publicHost, answers.httpPort, answers.useHttps);
  const adminResolution = await reconcileAdminAccount(answers, lang);
  return {
    answers: adminResolution.answers,
    adminAction: adminResolution.action,
    generatedPassword: adminResolution.generatedPassword,
    emailTransferFromUsername: adminResolution.emailTransferFromUsername,
  };
}

async function applyAdminPlan(result: ConfigureResult): Promise<void> {
  if (result.emailTransferFromUsername && result.emailTransferFromUsername !== result.answers.adminUsername) {
    await clearUserEmail(result.emailTransferFromUsername, result.answers.dbPath);
  }

  if (result.adminAction === 'reset') {
    await resetAdminPassword(result.answers.adminUsername, result.answers.adminPassword);
  } else if (result.adminAction === 'create') {
    const created = await createAdmin(result.answers.adminUsername, result.answers.adminPassword, result.answers.adminEmail);
    if (!created.created) {
      throw new Error(created.reason ?? `Failed to create admin ${result.answers.adminUsername}`);
    }
  }

  if (result.adminAction !== 'create' || result.emailTransferFromUsername) {
    await assignUserEmail(result.answers.adminUsername, result.answers.adminEmail, result.answers.dbPath);
  }
}

function persistEnvAndMeta(result: ConfigureResult): void {
  const currentMeta = readCliMeta();
  writeEnvFile(configureAnswersToEnv(result.answers));
  writeCliMeta({
    ...currentMeta,
    language: result.answers.lang,
    exposure: result.answers.exposure,
    deploymentMode: undefined,
    purpose: result.answers.purpose,
    serviceName: currentMeta.serviceName ?? 'uruc',
  });
}

export async function runConfigureCommand(context: CommandContext): Promise<void> {
  const result = await gatherAnswers(context);
  const { answers } = result;
  const lang = answers.lang;

  printSection(text(lang, 'summaryTitle'));
  for (const line of getConfigureSummaryLines(answers, lang)) {
    console.log(`- ${line}`);
  }
  if (result.generatedPassword) {
    printStatus('info', text(lang, 'generatedPassword'));
  }

  printSection(text(lang, 'actionsTitle'));
  for (const action of getConfigureActions(answers, lang)) {
    console.log(`- ${action}`);
  }

  const nextAction = await promptChoice(
    text(lang, 'applyPrompt'),
    [
      { value: 'apply', label: text(lang, 'applyNow') },
      { value: 'edit', label: text(lang, 'editAgain') },
    ],
    'apply',
    lang,
  );

  if (nextAction === 'edit') {
    await runConfigureCommand(context);
    return;
  }

  persistEnvAndMeta(result);
  await applyAdminPlan(result);

  const siteUrl = buildSiteUrl(answers.baseUrl, answers.appBasePath);
  printSection(text(lang, 'finishedTitle'));
  console.log(text(lang, 'configureSaved'));
  console.log(`City:       ${siteUrl}`);
  console.log(`Health:     ${answers.baseUrl.replace(/\/$/, '')}/api/health`);
  console.log(`WebSocket:  ${(answers.baseUrl.startsWith('https://') ? answers.baseUrl.replace(/^https:/, 'wss:') : answers.baseUrl.replace(/^http:/, 'ws:')).replace(/\/$/, '')}/ws`);
  console.log(`Bind host:  ${answers.bindHost}`);
  if (result.generatedPassword) {
    console.log(`Admin:      ${answers.adminUsername}`);
    console.log(`Password:   ${answers.adminPassword}`);
  }
}
