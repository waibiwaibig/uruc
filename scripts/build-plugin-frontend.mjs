import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { build } from 'vite';
import react from '@vitejs/plugin-react';

const execFileAsync = promisify(execFile);
const SHARED_FRONTEND_MODULES = new Set([
  '@uruc/plugin-sdk',
  'react',
  'react-dom',
  'i18next',
  'react-i18next',
  'react-router-dom',
  'lucide-react',
]);

function readOption(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }
  return args[index + 1] ?? null;
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing ${field}`);
  }
  return value;
}

function repoRootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

async function main() {
  const args = process.argv.slice(2);
  const pluginRootArg = readOption(args, '--plugin') ?? args[0];
  if (!pluginRootArg) {
    throw new Error('Usage: node scripts/build-plugin-frontend.mjs --plugin <path> [--out <dir>]');
  }

  const pluginRoot = path.resolve(process.cwd(), pluginRootArg);
  const outDir = path.resolve(
    process.cwd(),
    readOption(args, '--out') ?? path.join(pluginRoot, 'frontend-dist'),
  );
  const packageJson = JSON.parse(await readFile(path.join(pluginRoot, 'package.json'), 'utf8'));
  const pluginId = assertString(packageJson?.urucPlugin?.pluginId, 'package.json#urucPlugin.pluginId');
  const version = assertString(packageJson?.version, 'package.json#version');
  const frontendEntry = assertString(packageJson?.urucFrontend?.entry, 'package.json#urucFrontend.entry');
  const frontendEntryPath = path.resolve(pluginRoot, frontendEntry);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'uruc-plugin-frontend-build-'));
  const npmCacheDir = path.join(tempDir, 'npm-cache');
  const wrapperPath = path.join(tempDir, 'entry.ts');
  const installDependencies = Object.entries(packageJson.dependencies ?? {})
    .filter(([dependencyName]) => !SHARED_FRONTEND_MODULES.has(dependencyName))
    .map(([dependencyName, version]) => `${dependencyName}@${version}`);

  try {
    await mkdir(outDir, { recursive: true });
    if (installDependencies.length > 0) {
      await execFileAsync('npm', [
        'install',
        '--no-save',
        '--package-lock=false',
        '--no-audit',
        '--no-fund',
        ...installDependencies,
      ], {
        cwd: pluginRoot,
        env: {
          ...process.env,
          npm_config_cache: npmCacheDir,
        },
      });
    }
    await writeFile(wrapperPath, `import plugin from ${JSON.stringify(frontendEntryPath)};

globalThis.__uruc_plugin_exports = globalThis.__uruc_plugin_exports || {};
globalThis.__uruc_plugin_exports[${JSON.stringify(pluginId)}] = plugin;
`, 'utf8');

    await build({
      configFile: false,
      root: repoRootFromScript(),
      plugins: [react()],
      build: {
        minify: false,
        sourcemap: false,
        emptyOutDir: true,
        outDir,
        cssCodeSplit: false,
        lib: {
          entry: wrapperPath,
          formats: ['iife'],
          name: '__UrucPluginBundle',
        },
        rollupOptions: {
          external: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            'i18next',
            'react-i18next',
            'react-router-dom',
            'lucide-react',
            '@uruc/plugin-sdk/frontend',
            '@uruc/plugin-sdk/frontend-react',
            '@uruc/plugin-sdk/frontend-http',
          ],
          output: {
            entryFileNames: 'plugin.js',
            assetFileNames: (assetInfo) => {
              const assetName = assetInfo.names?.[0] ?? assetInfo.name ?? 'asset';
              if (assetName.endsWith('.css')) {
                return 'plugin.css';
              }
              return 'assets/[name]-[hash][extname]';
            },
            globals: {
              react: '__uruc_plugin_globals.React',
              'react-dom': '__uruc_plugin_globals.ReactDOM',
              'react/jsx-runtime': '__uruc_plugin_globals.ReactJsxRuntime',
              'react/jsx-dev-runtime': '__uruc_plugin_globals.ReactJsxDevRuntime',
              i18next: '__uruc_plugin_globals.I18next',
              'react-i18next': '__uruc_plugin_globals.ReactI18next',
              'react-router-dom': '__uruc_plugin_globals.ReactRouterDom',
              'lucide-react': '__uruc_plugin_globals.LucideReact',
              '@uruc/plugin-sdk/frontend': '__uruc_plugin_globals.UrucPluginSdkFrontend',
              '@uruc/plugin-sdk/frontend-react': '__uruc_plugin_globals.UrucPluginSdkFrontendReact',
              '@uruc/plugin-sdk/frontend-http': '__uruc_plugin_globals.UrucPluginSdkFrontendHttp',
            },
          },
        },
      },
    });

    const outFiles = await readdir(outDir);
    const css = outFiles.includes('plugin.css') ? ['./plugin.css'] : [];
    await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify({
      apiVersion: 1,
      pluginId,
      version,
      format: 'global-script',
      entry: './plugin.js',
      css,
      exportKey: pluginId,
    }, null, 2)}\n`, 'utf8');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
