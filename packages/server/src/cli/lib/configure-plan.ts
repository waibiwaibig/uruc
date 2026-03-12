import os from 'os';

import { buildSiteUrl } from './env.js';
import type { ConfigureAnswers, ExposureMode, UiLanguage } from './types.js';

const exposureLabels: Record<UiLanguage, Record<ExposureMode, string>> = {
  'zh-CN': {
    'local-only': '仅本机',
    'lan-share': '局域网共享',
    'direct-public': '公网直连',
  },
  en: {
    'local-only': 'Local only',
    'lan-share': 'LAN share',
    'direct-public': 'Direct public',
  },
  ko: {
    'local-only': '로컬 전용',
    'lan-share': 'LAN 공유',
    'direct-public': '공용 직접 노출',
  },
};

const purposeLabels = {
  'zh-CN': { test: '测试', production: '正式' },
  en: { test: 'Test', production: 'Production' },
  ko: { test: '테스트', production: '운영' },
} as const;

export function getConfigureActions(answers: ConfigureAnswers, lang: UiLanguage): string[] {
  if (lang === 'zh-CN') {
    return [
      '写入 packages/server/.env',
      '更新 .uruc/cli.json 运行时元数据',
      '按需创建或重置管理员账号',
      '保留 nginx / SSL / systemd 给外部运维层处理',
      '后续通过 `uruc start` 或 `uruc start -b` 启动 city runtime',
    ];
  }

  if (lang === 'ko') {
    return [
      'packages/server/.env 에 runtime 설정을 저장합니다',
      '.uruc/cli.json 메타데이터를 갱신합니다',
      '필요하면 관리자 계정을 생성하거나 비밀번호를 재설정합니다',
      'nginx / SSL / systemd 는 외부 운영 계층에 맡깁니다',
      '이후 `uruc start` 또는 `uruc start -b` 로 city runtime 을 실행합니다',
    ];
  }

  return [
    'Write runtime config to packages/server/.env',
    'Refresh .uruc/cli.json runtime metadata',
    'Create or reset the admin account if needed',
    'Leave nginx / SSL / systemd to external ops tooling',
    'Start the city runtime later with `uruc start` or `uruc start -b`',
  ];
}

export function getConfigureSummaryLines(answers: ConfigureAnswers, lang: UiLanguage): string[] {
  const siteUrl = buildSiteUrl(answers.baseUrl, answers.appBasePath);

  if (lang === 'zh-CN') {
    return [
      `暴露方式: ${exposureLabels[lang][answers.exposure]}`,
      `实例用途: ${purposeLabels[lang][answers.purpose]}`,
      `绑定地址: ${answers.bindHost}`,
      `对外入口: ${siteUrl}`,
      `HTTP / WS: ${answers.httpPort} / ${answers.wsPort}`,
      `管理员: ${answers.adminUsername}`,
      `开放注册: ${answers.allowRegister ? '是' : '否'}`,
      `搜索引擎收录: ${answers.noindex ? '禁止' : '允许'}`,
      `City 路径: ${answers.appBasePath || '/'}`,
      `数据库: ${answers.dbPath}`,
      `插件配置: ${answers.pluginConfigPath}`,
      `运行环境: ${os.platform()} ${os.release()}`,
    ];
  }

  if (lang === 'ko') {
    return [
      `노출 방식: ${exposureLabels[lang][answers.exposure]}`,
      `용도: ${purposeLabels[lang][answers.purpose]}`,
      `바인드 주소: ${answers.bindHost}`,
      `공개 진입점: ${siteUrl}`,
      `HTTP / WS: ${answers.httpPort} / ${answers.wsPort}`,
      `관리자: ${answers.adminUsername}`,
      `공개 가입: ${answers.allowRegister ? '예' : '아니요'}`,
      `검색 엔진 색인: ${answers.noindex ? '차단' : '허용'}`,
      `City 경로: ${answers.appBasePath || '/'}`,
      `DB: ${answers.dbPath}`,
      `플러그인 설정: ${answers.pluginConfigPath}`,
      `런타임 환경: ${os.platform()} ${os.release()}`,
    ];
  }

  return [
    `Exposure: ${exposureLabels[lang][answers.exposure]}`,
    `Purpose: ${purposeLabels[lang][answers.purpose]}`,
    `Bind host: ${answers.bindHost}`,
    `Public entry: ${siteUrl}`,
    `HTTP / WS: ${answers.httpPort} / ${answers.wsPort}`,
    `Admin: ${answers.adminUsername}`,
    `Public registration: ${answers.allowRegister ? 'Yes' : 'No'}`,
    `Search indexing: ${answers.noindex ? 'Blocked' : 'Allowed'}`,
    `City path: ${answers.appBasePath || '/'}`,
    `DB: ${answers.dbPath}`,
    `Plugin config: ${answers.pluginConfigPath}`,
    `Runtime: ${os.platform()} ${os.release()}`,
  ];
}
