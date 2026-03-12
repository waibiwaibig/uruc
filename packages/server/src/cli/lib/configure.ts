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
    '记录 .uruc/cli.json 元数据',
    '按需同步管理员账号',
    '如缺失则自动准备依赖与构建产物',
    '可选立即启动主城',
  ];
}

export function getConfigureSummaryLines(answers: ConfigureAnswers): string[] {
  const siteUrl = buildSiteUrl(answers.siteProtocol, answers.publicHost, answers.httpPort, answers.baseUrl);
  return [
    `建城方式: ${reachabilityLabel(answers.reachability)}`,
    `实例用途: ${purposeLabel(answers.purpose)}`,
    `分享地址: ${siteUrl}`,
    `监听地址: ${answers.bindHost}`,
    `HTTP / WS: ${answers.httpPort} / ${answers.wsPort}`,
    `管理员: ${answers.adminUsername}`,
    `开放注册: ${answers.allowRegister ? '是' : '否'}`,
    `站点访问密码: ${answers.sitePassword ? '已设置' : '未设置'}`,
    `搜索引擎收录: ${answers.noindex ? '禁止' : '允许'}`,
    `数据库: ${answers.dbPath}`,
    `插件配置: ${answers.pluginConfigPath}`,
    `运行环境: ${os.platform()} ${os.release()}`,
  ];
}

