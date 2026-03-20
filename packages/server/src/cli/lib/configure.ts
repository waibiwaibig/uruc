import os from 'os';

import { buildSiteUrl, buildPublicWsUrl } from './network.js';
import { readCliMeta, writeCliMeta } from './state.js';
import type { CityReachability, ConfigureAnswers } from './types.js';

function reachabilityLabel(reachability: CityReachability): string {
  if (reachability === 'local') return '本机';
  if (reachability === 'lan') return '局域网';
  return '服务器';
}

function purposeLabel(purpose: ConfigureAnswers['purpose']): string {
  return purpose === 'production' ? '正式' : '测试';
}

function localizedReachabilityLabel(lang: ConfigureAnswers['lang'], reachability: CityReachability): string {
  if (lang === 'en') {
    if (reachability === 'local') return 'Local';
    if (reachability === 'lan') return 'LAN';
    return 'Server';
  }
  if (lang === 'ko') {
    if (reachability === 'local') return '로컬';
    if (reachability === 'lan') return 'LAN';
    return '서버';
  }
  return reachabilityLabel(reachability);
}

function localizedPurposeLabel(lang: ConfigureAnswers['lang'], purpose: ConfigureAnswers['purpose']): string {
  if (lang === 'en') return purpose === 'production' ? 'Production' : 'Test';
  if (lang === 'ko') return purpose === 'production' ? '운영' : '테스트';
  return purposeLabel(purpose);
}

function fieldLabel(lang: ConfigureAnswers['lang'], key: string): string {
  const table = {
    'zh-CN': {
      mode: '配置模式',
      reachability: '建城方式',
      purpose: '实例用途',
      siteUrl: '分享地址',
      bindHost: '监听地址',
      ports: 'HTTP / WS',
      admin: '管理员',
      register: '开放注册',
      sitePassword: '站点访问密码',
      index: '搜索引擎收录',
      db: '数据库',
      cityConfig: '城市配置',
      preset: '插件预设',
      enabledPlugins: '启用插件',
      pluginStore: '插件存储',
      runtime: '运行环境',
      yes: '是',
      no: '否',
      set: '已设置',
      unset: '未设置',
      blocked: '禁止',
      allowed: '允许',
      quickstart: 'QuickStart',
      advanced: 'Advanced',
    },
    en: {
      mode: 'Mode',
      reachability: 'Reachability',
      purpose: 'Purpose',
      siteUrl: 'Share URL',
      bindHost: 'Bind host',
      ports: 'HTTP / WS',
      admin: 'Admin',
      register: 'Open registration',
      sitePassword: 'Site password',
      index: 'Search indexing',
      db: 'Database',
      cityConfig: 'City config',
      preset: 'Plugin preset',
      enabledPlugins: 'Enabled plugins',
      pluginStore: 'Plugin store',
      runtime: 'Runtime',
      yes: 'yes',
      no: 'no',
      set: 'set',
      unset: 'unset',
      blocked: 'blocked',
      allowed: 'allowed',
      quickstart: 'QuickStart',
      advanced: 'Advanced',
    },
    ko: {
      mode: '구성 모드',
      reachability: '도시 공개 범위',
      purpose: '용도',
      siteUrl: '공유 주소',
      bindHost: '바인드 주소',
      ports: 'HTTP / WS',
      admin: '관리자',
      register: '회원가입 개방',
      sitePassword: '사이트 비밀번호',
      index: '검색 색인',
      db: '데이터베이스',
      cityConfig: '도시 설정',
      preset: '플러그인 프리셋',
      enabledPlugins: '활성화된 플러그인',
      pluginStore: '플러그인 스토어',
      runtime: '런타임',
      yes: '예',
      no: '아니요',
      set: '설정됨',
      unset: '없음',
      blocked: '차단',
      allowed: '허용',
      quickstart: 'QuickStart',
      advanced: 'Advanced',
    },
  } as const;
  return table[lang][key as keyof typeof table['zh-CN']];
}

function presetLabel(preset: ConfigureAnswers['pluginPreset']): string {
  if (preset === 'empty-core') return 'empty-core';
  if (preset === 'custom') return 'custom';
  return 'social-only';
}

function enabledBundledPlugins(answers: ConfigureAnswers): string {
  return Object.entries(answers.bundledPluginState)
    .filter(([, enabled]) => enabled)
    .map(([pluginId]) => pluginId)
    .join(', ') || 'none';
}

export function rememberConfiguration(answers: ConfigureAnswers): void {
  const siteUrl = buildSiteUrl(answers.siteProtocol, answers.publicHost, answers.httpPort, answers.baseUrl);
  const wsUrl = buildPublicWsUrl(siteUrl, answers.wsPort);
  writeCliMeta({
    ...readCliMeta(),
    language: answers.lang,
    reachability: answers.reachability,
    purpose: answers.purpose,
    serviceName: readCliMeta().serviceName ?? 'uruc',
    configure: {
      completedAt: new Date().toISOString(),
      reachability: answers.reachability,
      siteUrl,
      wsUrl,
      bindHost: answers.bindHost,
    },
  });
}

export function getConfigureActions(): string[] {
  return [
    '写入 packages/server/.env',
    '确保 uruc.city.json 存在并应用当前插件预设',
    '同步 uruc.city.lock.json',
    '记录 .uruc/cli.json 元数据',
    '按需同步管理员账号',
    '如缺失则自动准备依赖与构建产物',
    '可选立即启动主城',
  ];
}

export function getConfigureSummaryLines(answers: ConfigureAnswers): string[] {
  const siteUrl = buildSiteUrl(answers.siteProtocol, answers.publicHost, answers.httpPort, answers.baseUrl);
  const lang = answers.lang;
  return [
    `${fieldLabel(lang, 'mode')}: ${fieldLabel(lang, answers.mode)}` + `${answers.section !== 'all' ? ` · ${answers.section}` : ''}`,
    `${fieldLabel(lang, 'reachability')}: ${localizedReachabilityLabel(lang, answers.reachability)}`,
    `${fieldLabel(lang, 'purpose')}: ${localizedPurposeLabel(lang, answers.purpose)}`,
    `${fieldLabel(lang, 'siteUrl')}: ${siteUrl}`,
    `${fieldLabel(lang, 'bindHost')}: ${answers.bindHost}`,
    `${fieldLabel(lang, 'ports')}: ${answers.httpPort} / ${answers.wsPort}`,
    `${fieldLabel(lang, 'admin')}: ${answers.adminUsername}`,
    `${fieldLabel(lang, 'register')}: ${answers.allowRegister ? fieldLabel(lang, 'yes') : fieldLabel(lang, 'no')}`,
    `${fieldLabel(lang, 'sitePassword')}: ${answers.sitePassword ? fieldLabel(lang, 'set') : fieldLabel(lang, 'unset')}`,
    `${fieldLabel(lang, 'index')}: ${answers.noindex ? fieldLabel(lang, 'blocked') : fieldLabel(lang, 'allowed')}`,
    `${fieldLabel(lang, 'db')}: ${answers.dbPath}`,
    `${fieldLabel(lang, 'cityConfig')}: ${answers.cityConfigPath}`,
    `${fieldLabel(lang, 'preset')}: ${presetLabel(answers.pluginPreset)}`,
    `${fieldLabel(lang, 'enabledPlugins')}: ${enabledBundledPlugins(answers)}`,
    `${fieldLabel(lang, 'pluginStore')}: ${answers.pluginStoreDir}`,
    `${fieldLabel(lang, 'runtime')}: ${os.platform()} ${os.release()}`,
  ];
}
