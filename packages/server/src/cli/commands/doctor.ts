import { existsSync } from 'fs';
import path from 'path';

import { PluginDiscovery } from '../../core/plugin-system/discovery.js';
import { getPackageRoot, getPluginConfigPath } from '../../runtime-paths.js';
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
  name: string;
  state?: string;
  reason?: string;
}

export async function runDoctorCommand(context: CommandContext): Promise<void> {
  const checks: DoctorCheck[] = [];
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
  const resolvedPluginConfigPath = runtime.pluginConfigPath;
  const resolvedPublicDir = runtime.publicDir;

  checks.push({
    level: existsSync(resolvedDbPath) ? 'ok' : 'warn',
    name: 'db-path',
    detail: `DB=${resolvedDbPath}`,
  });
  checks.push({
    level: existsSync(resolvedPluginConfigPath) ? 'ok' : 'warn',
    name: 'plugin-config',
    detail: `PLUGIN_CONFIG=${resolvedPluginConfigPath}`,
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

  try {
    const configPath = env.PLUGIN_CONFIG_PATH
      ? (path.isAbsolute(env.PLUGIN_CONFIG_PATH) ? env.PLUGIN_CONFIG_PATH : path.resolve(packageRoot, env.PLUGIN_CONFIG_PATH))
      : getPluginConfigPath();
    const discovery = new PluginDiscovery(configPath, packageRoot);
    await discovery.loadConfig();
    const discovered = await discovery.discoverPlugins();
    const stale = discovery.getStaleConfiguredPlugins(discovered);
    checks.push({
      level: stale.length > 0 ? 'warn' : 'ok',
      name: 'plugins',
      detail: stale.length > 0
        ? `Discovered ${discovered.size} plugins; stale config entries: ${stale.join(', ')}`
        : `Discovered ${discovered.size} plugins from ${discovery.getConfigPath()}`,
    });

    const enabledAutoLoad = Array.from(discovered.entries()).filter(([name]) => (
      discovery.isEnabled(name) && discovery.shouldAutoLoad(name)
    ));
    const loadFailures: string[] = [];
    for (const [name, metadata] of enabledAutoLoad) {
      try {
        await discovery.loadPluginInstance(metadata);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        loadFailures.push(`${name} (${message})`);
      }
    }

    checks.push({
      level: loadFailures.length > 0 ? 'fail' : 'ok',
      name: 'plugin-load',
      detail: loadFailures.length > 0
        ? `Failed to load enabled plugins: ${loadFailures.join('; ')}`
        : `Validated ${enabledAutoLoad.length} enabled auto-load plugin(s)`,
    });
  } catch (error) {
    checks.push({
      level: 'fail',
      name: 'plugins',
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const runtimePluginDiagnostics = readRuntimePluginDiagnostics(runtime.health.body);
  if (runtime.health.ok && runtimePluginDiagnostics.length > 0) {
    const runtimeFailures = runtimePluginDiagnostics
      .filter((item) => item.state === 'failed')
      .map((item) => item.reason ? `${item.name} (${item.reason})` : item.name);

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
    pluginConfigPath: runtime.pluginConfigPath,
    siteUrl: runtime.siteUrl,
    healthUrl: runtime.healthUrl,
    wsUrl: runtime.wsUrl,
    runtimeMode: runtime.mode,
    checks,
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
  console.log(`Plugins:     ${report.pluginConfigPath}`);
  console.log(`Site:        ${report.siteUrl}`);
  console.log(`Health:      ${report.healthUrl}`);
  console.log(`WS:          ${report.wsUrl}`);
  console.log('');
  for (const check of checks) {
    printStatus(check.level, `${check.name}: ${check.detail}`);
  }
}

function readRuntimePluginDiagnostics(body: unknown): RuntimePluginDiagnostic[] {
  if (!body || typeof body !== 'object') return [];
  const diagnostics = (body as { pluginDiagnostics?: unknown }).pluginDiagnostics;
  if (!Array.isArray(diagnostics)) return [];

  return diagnostics.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as RuntimePluginDiagnostic;
    if (typeof candidate.name !== 'string') return [];
    return [candidate];
  });
}
