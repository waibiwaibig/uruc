import os from 'os';

import {
  adminExists,
  createAdmin,
  getUserRole,
  resolveAdminPasswordState,
  resetAdminPassword,
} from '../lib/admin.js';
import {
  currentSetupDefaults,
  ensureServerEnvFile,
  getCurrentLanguage,
  getDefaultPluginConfig,
  rootEnvExists,
  setupAnswersToEnv,
  writeEnvFile,
} from '../lib/env.js';
import {
  getSetupActions,
  getSetupSummaryLines,
  installServer,
  saveLocalSetupMeta,
} from '../lib/server-install.js';
import { readCliMeta, writeCliMeta } from '../lib/state.js';
import {
  printBanner,
  printSection,
  printStatus,
  promptChoice,
  promptConfirm,
  promptInput,
  t,
} from '../lib/ui.js';
import type {
  CommandContext,
  DeploymentMode,
  InstancePurpose,
  SetupAnswers,
  UiLanguage,
} from '../lib/types.js';

interface SetupResult {
  answers: SetupAnswers;
  adminAction: 'create' | 'keep' | 'reset';
  generatedPassword: boolean;
}

const copy = {
  'zh-CN': {
    setupTitle: 'Setup',
    invalidRootEnv: '检测到仓库根目录 .env：当前 CLI 不会读取它，真正生效的是 packages/server/.env。',
    languagePrompt: '请选择语言',
    modePrompt: '你要把 Uruc 部署在哪里？',
    purposePrompt: '这个实例的用途是什么？',
    hostPrompt: '访问地址（本地填 127.0.0.1，服务器填域名或公网 IP）',
    httpPortPrompt: 'HTTP 端口',
    wsPortPrompt: 'WebSocket 端口',
    sslPrompt: '是否启用 HTTPS（SSL）？',
    sslEmailPrompt: '申请证书使用的邮箱',
    adminUserPrompt: '管理员用户名',
    adminPasswordPrompt: '管理员密码',
    adminEmailPrompt: '管理员邮箱',
    allowRegisterPrompt: '是否开放注册？',
    noindexPrompt: '是否禁止搜索引擎收录？',
    sitePasswordPrompt: '站点访问密码（可选）',
    advancedPrompt: '是否配置高级项？',
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
    applyPrompt: '选择下一步',
    applyNow: '立即应用',
    saveOnly: '只保存配置',
    editAgain: '返回修改',
    serverRootHint: '服务器部署需要 root。请改用 `sudo uruc setup`。',
    localReady: '本地配置已写入。后续直接运行 `uruc start` 即可。',
    summaryTitle: '配置摘要',
    actionsTitle: '即将执行',
    finishedTitle: '完成',
    generatedPassword: '管理员密码未输入，已自动生成。',
    savedOnly: '配置已保存，未执行系统安装。',
  },
  en: {
    setupTitle: 'Setup',
    invalidRootEnv: 'A repo-root .env was found. Uruc ignores it; only packages/server/.env is active.',
    languagePrompt: 'Choose language',
    modePrompt: 'Where do you want to deploy Uruc?',
    purposePrompt: 'What is this instance for?',
    hostPrompt: 'Public host (127.0.0.1 for local, domain or public IP for server)',
    httpPortPrompt: 'HTTP port',
    wsPortPrompt: 'WebSocket port',
    sslPrompt: 'Enable HTTPS (SSL)?',
    sslEmailPrompt: 'Email for certificate issuance',
    adminUserPrompt: 'Admin username',
    adminPasswordPrompt: 'Admin password',
    adminEmailPrompt: 'Admin email',
    allowRegisterPrompt: 'Allow public registration?',
    noindexPrompt: 'Block search engine indexing?',
    sitePasswordPrompt: 'Site access password (optional)',
    advancedPrompt: 'Configure advanced settings?',
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
    existingAdminPrompt: 'This admin username already exists. How should setup handle it?',
    existingUserPrompt: 'This username already exists but is not an admin. Pick a new username or promote it later with `uruc admin promote`.',
    keepAdmin: 'Keep the existing admin account',
    resetAdmin: 'Reset that admin password',
    renameAdmin: 'Choose a new admin username',
    keepPasswordPrompt: 'Enter the current admin password for verification',
    applyPrompt: 'Choose the next step',
    applyNow: 'Apply now',
    saveOnly: 'Save config only',
    editAgain: 'Go back and edit',
    serverRootHint: 'Server setup requires root. Run `sudo uruc setup`.',
    localReady: 'Local configuration saved. Run `uruc start` next.',
    summaryTitle: 'Summary',
    actionsTitle: 'Planned actions',
    finishedTitle: 'Done',
    generatedPassword: 'No admin password was entered, so Uruc generated one.',
    savedOnly: 'Configuration was saved without system installation.',
  },
  ko: {
    setupTitle: '설정',
    invalidRootEnv: '저장소 루트의 .env 가 감지되었습니다. Uruc 는 이를 무시하며 packages/server/.env 만 사용합니다.',
    languagePrompt: '언어를 선택하세요',
    modePrompt: 'Uruc를 어디에 배포하시겠습니까?',
    purposePrompt: '이 인스턴스의 용도는 무엇입니까?',
    hostPrompt: '접속 주소 (로컬은 127.0.0.1, 서버는 도메인 또는 공인 IP)',
    httpPortPrompt: 'HTTP 포트',
    wsPortPrompt: 'WebSocket 포트',
    sslPrompt: 'HTTPS(SSL)를 사용하시겠습니까?',
    sslEmailPrompt: '인증서 발급용 이메일',
    adminUserPrompt: '관리자 사용자명',
    adminPasswordPrompt: '관리자 비밀번호',
    adminEmailPrompt: '관리자 이메일',
    allowRegisterPrompt: '회원가입을 허용하시겠습니까?',
    noindexPrompt: '검색 엔진 수집을 막으시겠습니까?',
    sitePasswordPrompt: '사이트 접근 비밀번호 (선택)',
    advancedPrompt: '고급 설정을 구성하시겠습니까?',
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
    applyPrompt: '다음 동작을 선택하세요',
    applyNow: '지금 적용',
    saveOnly: '설정만 저장',
    editAgain: '다시 수정',
    serverRootHint: '서버 설정에는 root 권한이 필요합니다. `sudo uruc setup` 를 실행하세요.',
    localReady: '로컬 설정이 저장되었습니다. 다음에 `uruc start` 를 실행하세요.',
    summaryTitle: '요약',
    actionsTitle: '실행 예정 작업',
    finishedTitle: '완료',
    generatedPassword: '관리자 비밀번호가 비어 있어 Uruc가 자동 생성했습니다.',
    savedOnly: '시스템 설치 없이 설정만 저장했습니다.',
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

function normalizeBaseUrl(answers: SetupAnswers): string {
  const scheme = answers.enableSsl ? 'https' : 'http';
  if (answers.mode === 'server') {
    return `${scheme}://${answers.publicHost}`;
  }
  const omitPort = (answers.enableSsl && answers.httpPort === '443') || (!answers.enableSsl && answers.httpPort === '80');
  return `${scheme}://${answers.publicHost}${omitPort ? '' : `:${answers.httpPort}`}`;
}

async function chooseLanguage(defaultLang: UiLanguage): Promise<UiLanguage> {
  console.log('Uruc Setup');
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
  answers: SetupAnswers,
  lang: UiLanguage,
): Promise<{ action: 'create' | 'keep' | 'reset'; generatedPassword: boolean; answers: SetupAnswers }> {
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

async function gatherAnswers(context: CommandContext): Promise<SetupResult> {
  ensureServerEnvFile();
  const storedLang = context.lang ?? readCliMeta().language ?? getCurrentLanguage();
  const lang = await chooseLanguage(storedLang);
  printBanner(lang, text(lang, 'setupTitle'));

  if (rootEnvExists()) {
    printStatus('warn', text(lang, 'invalidRootEnv'));
  }

  const cliMeta = readCliMeta();
  const existingMode = cliMeta.deploymentMode ?? 'local';
  const existingPurpose = cliMeta.purpose ?? 'test';
  const baseDefaults = currentSetupDefaults(
    existingMode,
    existingPurpose,
    existingMode === 'server' ? safeHostFromBaseUrl(process.env.BASE_URL, os.hostname()) : '127.0.0.1',
    process.env.PORT ?? '3000',
    process.env.WS_PORT ?? '3001',
  );

  const mode = await promptChoice<DeploymentMode>(
    text(lang, 'modePrompt'),
    [
      { value: 'local', label: lang === 'zh-CN' ? '本地试用' : lang === 'en' ? 'Local trial' : '로컬 테스트' },
      { value: 'server', label: lang === 'zh-CN' ? '服务器部署' : lang === 'en' ? 'Server deployment' : '서버 배포' },
    ],
    existingMode,
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

  const hostDefault = mode === 'server'
    ? (cliMeta.deploymentMode === 'server' ? safeHostFromBaseUrl(baseDefaults.baseUrl, os.hostname()) : os.hostname())
    : '127.0.0.1';
  const publicHost = await promptInput(text(lang, 'hostPrompt'), hostDefault);
  const httpPort = await promptInput(text(lang, 'httpPortPrompt'), baseDefaults.httpPort);
  const wsPort = await promptInput(text(lang, 'wsPortPrompt'), baseDefaults.wsPort);
  const defaults = currentSetupDefaults(mode, purpose, publicHost, httpPort, wsPort);

  const enableSsl = mode === 'server'
    ? await promptConfirm(text(lang, 'sslPrompt'), defaults.enableSsl, lang)
    : false;
  const letsencryptEmail = enableSsl
    ? await promptInput(text(lang, 'sslEmailPrompt'), defaults.letsencryptEmail || defaults.adminEmail)
    : '';

  const adminUsername = await promptInput(text(lang, 'adminUserPrompt'), defaults.adminUsername);
  let adminPassword = await promptInput(text(lang, 'adminPasswordPrompt'), defaults.adminPassword, { secret: true });
  const adminEmail = await promptInput(text(lang, 'adminEmailPrompt'), defaults.adminEmail);
  const allowRegister = await promptConfirm(text(lang, 'allowRegisterPrompt'), defaults.allowRegister, lang);
  const noindex = await promptConfirm(text(lang, 'noindexPrompt'), defaults.noindex, lang);
  const sitePassword = await promptInput(text(lang, 'sitePasswordPrompt'), defaults.sitePassword, { secret: true });

  const answers: SetupAnswers = {
    ...defaults,
    lang,
    mode,
    purpose,
    publicHost,
    httpPort,
    wsPort,
    enableSsl,
    letsencryptEmail,
    adminUsername,
    adminPassword,
    adminEmail,
    allowRegister,
    noindex,
    sitePassword,
    baseUrl: defaults.baseUrl,
  };

  const advanced = await promptConfirm(text(lang, 'advancedPrompt'), false, lang);
  if (advanced) {
    answers.dbPath = await promptInput(text(lang, 'dbPathPrompt'), defaults.dbPath);
    answers.pluginConfigPath = await promptInput(text(lang, 'pluginConfigPrompt'), defaults.pluginConfigPath || getDefaultPluginConfig(mode));
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

  answers.baseUrl = normalizeBaseUrl(answers);
  const adminResolution = await reconcileAdminAccount(answers, lang);
  return {
    answers: adminResolution.answers,
    adminAction: adminResolution.action,
    generatedPassword: adminResolution.generatedPassword,
  };
}

async function applyAdminPlan(result: SetupResult): Promise<void> {
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

function persistEnvAndMeta(result: SetupResult): void {
  writeEnvFile(setupAnswersToEnv(result.answers));
  writeCliMeta({
    ...readCliMeta(),
    language: result.answers.lang,
    deploymentMode: result.answers.mode,
    purpose: result.answers.purpose,
    serviceName: readCliMeta().serviceName ?? 'uruc',
  });
}

export async function runSetupCommand(context: CommandContext): Promise<void> {
  const result = await gatherAnswers(context);
  const { answers } = result;
  const lang = answers.lang;

  printSection(text(lang, 'summaryTitle'));
  for (const line of getSetupSummaryLines(answers)) {
    console.log(`- ${line}`);
  }
  if (result.generatedPassword) {
    printStatus('info', text(lang, 'generatedPassword'));
  }

  printSection(text(lang, 'actionsTitle'));
  for (const action of getSetupActions(answers)) {
    console.log(`- ${action}`);
  }

  const nextAction = await promptChoice(
    text(lang, 'applyPrompt'),
    [
      { value: 'apply', label: text(lang, 'applyNow') },
      { value: 'save', label: text(lang, 'saveOnly') },
      { value: 'edit', label: text(lang, 'editAgain') },
    ],
    'apply',
    lang,
  );

  if (nextAction === 'edit') {
    await runSetupCommand(context);
    return;
  }

  if (answers.mode === 'server' && nextAction === 'apply' && typeof process.getuid === 'function' && process.getuid() !== 0) {
    throw new Error(text(lang, 'serverRootHint'));
  }

  persistEnvAndMeta(result);
  await applyAdminPlan(result);

  if (answers.mode === 'local' || nextAction === 'save') {
    saveLocalSetupMeta(answers);
    printSection(text(lang, 'finishedTitle'));
    console.log(nextAction === 'save' ? text(lang, 'savedOnly') : text(lang, 'localReady'));
    console.log(`packages/server/.env -> ${answers.baseUrl}`);
    if (result.generatedPassword) {
      console.log(`Admin: ${answers.adminUsername}`);
      console.log(`Password: ${answers.adminPassword}`);
    }
    return;
  }

  const summary = await installServer(answers);
  printSection(text(lang, 'finishedTitle'));
  console.log(`Site:        ${summary.siteUrl}`);
  console.log(`Health:      ${summary.healthUrl}`);
  console.log(`WebSocket:   ${summary.wsUrl}`);
  console.log(`Admin user:  ${summary.adminUsername}`);
  console.log(`Admin pass:  ${summary.adminPassword}`);
  console.log(`Service:     ${summary.serviceName}`);
  if (summary.nginxConfigPath) {
    console.log(`Nginx conf:  ${summary.nginxConfigPath}`);
  }
}
