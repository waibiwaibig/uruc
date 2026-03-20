import { existsSync } from 'fs';
import path from 'path';

import { readCityConfig, readCityLock } from '../../core/plugin-platform/config.js';
import {
  aggregatePluginCheckLevel,
  inspectConfiguredPlugins,
  summarizePluginChecks,
  type PluginCheck,
} from '../../core/plugin-platform/inspection.js';
import { getPackageRoot, getCityConfigPath, getCityLockPath } from '../../runtime-paths.js';
import { adminExists, resolveAdminPasswordState } from '../lib/admin.js';
import { getBuildFreshness } from '../lib/build.js';
import { loadServerEnv, parseEnvFile, rootEnvExists, serverEnvExists } from '../lib/env.js';
import { getRuntimeStatus } from '../lib/runtime.js';
import { getRootEnvPath, getServerEnvPath } from '../lib/state.js';
import { printStatus } from '../lib/ui.js';
import type { CommandContext } from '../lib/types.js';

interface DoctorCheck {
  level: 'ok' | 'warn' | 'fail';
  name: string;
  detail: string;
}

interface RuntimePluginDiagnostic {
  name?: string;
  pluginId?: string;
  state?: string;
  reason?: string;
  lastError?: string;
}

function resolveDoctorTargetPath(rawPath: string | undefined, fallback: string, packageRoot: string): string {
  if (!rawPath || rawPath.trim() === '') return fallback;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(packageRoot, rawPath);
}

export async function runDoctorCommand(context: CommandContext): Promise<void> {
  const checks: DoctorCheck[] = [];
  let pluginChecks: PluginCheck[] = [];
  const envPath = getServerEnvPath();
  const rootEnvPath = getRootEnvPath();
  const env = parseEnvFile(envPath);
  const packageRoot = getPackageRoot();

  checks.push({
    level: serverEnvExists() ? 'ok' : 'fail',
    name: 'server-env',
    detail: serverEnvExists() ? `Using ${envPath}` : `Missing ${envPath}`,
  });
  checks.push({
    level: rootEnvExists() ? 'warn' : 'ok',
    name: 'root-env',
    detail: rootEnvExists() ? `Repo root .env exists and is ignored: ${rootEnvPath}` : 'No invalid repo-root .env found',
  });

  if (serverEnvExists()) {
    loadServerEnv();
  }

  const runtime = await getRuntimeStatus();
  const resolvedDbPath = runtime.dbPath;
  const resolvedCityConfigPath = runtime.cityConfigPath;
  const resolvedPublicDir = runtime.publicDir;

  checks.push({
    level: existsSync(resolvedDbPath) ? 'ok' : 'warn',
    name: 'db-path',
    detail: `DB=${resolvedDbPath}`,
  });
  checks.push({
    level: existsSync(resolvedCityConfigPath) ? 'ok' : 'warn',
    name: 'city-config',
    detail: `CITY_CONFIG=${resolvedCityConfigPath}`,
  });
  checks.push({
    level: existsSync(resolvedPublicDir) ? 'ok' : 'warn',
    name: 'public-dir',
    detail: `PUBLIC_DIR=${resolvedPublicDir}`,
  });
  checks.push({
    level: 'ok',
    name: 'reachability',
    detail: `${runtime.reachability} via ${runtime.bindHost}`,
  });

  const build = getBuildFreshness();
  checks.push({
    level: build.stale ? 'warn' : 'ok',
    name: 'build',
    detail: build.reason,
  });
  checks.push({
    level: runtime.health.ok ? 'ok' : runtime.mode === 'stopped' ? 'warn' : 'fail',
    name: 'health',
    detail: runtime.health.ok
      ? `${runtime.healthUrl} -> ${runtime.health.statusCode}`
      : `${runtime.healthUrl} is unreachable${runtime.health.error ? ` (${runtime.health.error})` : ''}`,
  });

  const adminUsername = env.ADMIN_USERNAME ?? '';
  if (!adminUsername) {
    checks.push({ level: 'warn', name: 'admin', detail: 'ADMIN_USERNAME is not set' });
  } else {
    const exists = await adminExists(adminUsername, env.DB_PATH);
    checks.push({
      level: exists ? 'ok' : 'fail',
      name: 'admin-exists',
      detail: exists ? `Admin ${adminUsername} exists` : `Admin ${adminUsername} does not exist in the active DB`,
    });
    if (exists && env.ADMIN_PASSWORD) {
      const passwordState = await resolveAdminPasswordState(adminUsername, env.ADMIN_PASSWORD, env.DB_PATH);
      checks.push({
        level: passwordState === 'match' ? 'ok' : 'warn',
        name: 'admin-password',
        detail: passwordState === 'match'
          ? 'Configured admin password matches the database'
          : passwordState === 'mismatch'
            ? 'Configured admin password does not match the database'
            : 'Configured admin user is missing',
      });
    }
  }

  const runtimePluginDiagnostics = readRuntimePluginDiagnostics(runtime.health.body);
  const runtimePluginCheckDiagnostics = runtimePluginDiagnostics.flatMap((item) => {
    if (typeof item.pluginId !== 'string' || typeof item.state !== 'string') {
      return [];
    }
    return [{
      pluginId: item.pluginId,
      state: item.state as NonNullable<PluginCheck['runtimeState']>,
      lastError: item.lastError,
    }];
  });
  try {
    const configPath = resolveDoctorTargetPath(env.CITY_CONFIG_PATH, getCityConfigPath(), packageRoot);
    const lockPath = resolveDoctorTargetPath(env.CITY_LOCK_PATH, getCityLockPath(), packageRoot);
    const config = await readCityConfig(configPath);
    const lock = await readCityLock(lockPath);
    pluginChecks = await inspectConfiguredPlugins({
      config,
      lock,
      configPath,
      runtimeDiagnostics: runtimePluginCheckDiagnostics,
    });
    const pluginsLevel = aggregatePluginCheckLevel(pluginChecks.map((item) => item.status));

    checks.push({
      level: pluginsLevel,
      name: 'plugins',
      detail: `${summarizePluginChecks(pluginChecks)} from ${configPath}`,
    });
  } catch (error) {
    checks.push({
      level: 'fail',
      name: 'plugins',
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  if (runtime.health.ok && runtimePluginDiagnostics.length > 0) {
    const runtimeFailures = runtimePluginDiagnostics
      .filter((item) => item.state === 'failed')
      .map((item) => item.lastError ? `${item.pluginId ?? item.name} (${item.lastError})` : (item.pluginId ?? item.name ?? 'unknown'));

    checks.push({
      level: runtimeFailures.length > 0 ? 'fail' : 'ok',
      name: 'plugin-runtime',
      detail: runtimeFailures.length > 0
        ? `Runtime plugin failures: ${runtimeFailures.join('; ')}`
        : `Runtime reports ${runtimePluginDiagnostics.length} plugin(s) without failures`,
    });
  }

  const report = {
    envPath,
    rootEnvPath,
    reachability: runtime.reachability,
    bindHost: runtime.bindHost,
    dbPath: runtime.dbPath,
    cityConfigPath: runtime.cityConfigPath,
    siteUrl: runtime.siteUrl,
    healthUrl: runtime.healthUrl,
    wsUrl: runtime.wsUrl,
    runtimeMode: runtime.mode,
    checks,
    pluginChecks,
  };

  if (context.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Config:      ${report.envPath}`);
  console.log(`Repo root .env: ${rootEnvExists() ? rootEnvPath : '(absent)'}`);
  console.log(`Reachability:${report.reachability}`);
  console.log(`Bind host:   ${report.bindHost}`);
  console.log(`DB:          ${report.dbPath}`);
  console.log(`City config: ${report.cityConfigPath}`);
  console.log(`Site:        ${report.siteUrl}`);
  console.log(`Health:      ${report.healthUrl}`);
  console.log(`WS:          ${report.wsUrl}`);
  console.log('');
  for (const check of checks) {
    printStatus(check.level, `${check.name}: ${check.detail}`);
  }
  if (pluginChecks.length > 0) {
    console.log('');
    console.log('Plugin checks:');
    for (const pluginCheck of pluginChecks) {
      const runtimeSuffix = pluginCheck.runtimeState
        ? `; runtime=${pluginCheck.runtimeState}${pluginCheck.runtimeDetail ? ` (${pluginCheck.runtimeDetail})` : ''}`
        : '';
      printStatus(
        pluginCheck.status,
        `${pluginCheck.pluginId}: config=${pluginCheck.configStatus} (${pluginCheck.configDetail}); lock=${pluginCheck.lockStatus} (${pluginCheck.lockDetail})${runtimeSuffix}`,
      );
    }
  }
}

function readRuntimePluginDiagnostics(body: unknown): RuntimePluginDiagnostic[] {
  if (!body || typeof body !== 'object') return [];
  const diagnostics = (body as { pluginDiagnostics?: unknown }).pluginDiagnostics;
  if (!Array.isArray(diagnostics)) return [];

  return diagnostics.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as RuntimePluginDiagnostic;
    if (typeof candidate.name !== 'string' && typeof candidate.pluginId !== 'string') return [];
    return [candidate];
  });
}
