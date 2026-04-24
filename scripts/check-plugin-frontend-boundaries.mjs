import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const pluginPackagesRoot = path.join(root, 'packages/plugins');
const coreTypesFile = path.join(root, 'packages/web/src/lib/types.ts');
const coreApiFile = path.join(root, 'packages/web/src/lib/api.ts');
const registryFile = path.join(root, 'packages/web/src/plugins/registry.ts');
const pluginRouteElementFile = path.join(root, 'packages/web/src/components/plugins/PluginRouteElement.tsx');

const forbiddenImportSnippets = [
  'web/src/context/',
  'web/src/i18n',
  'web/src/lib/ws',
  'web/src/lib/types',
  'web/src/lib/api',
];

const cssImportPattern = /^\s*import\s+(?:[^'"()]+?\s+from\s+)?['"]([^'"]+\.css(?:\?[^'"]*)?)['"];?/gm;
const forbiddenGlobalCssPatterns = [
  { label: '.hidden', pattern: /\.hidden\b/ },
  { label: '.flex', pattern: /\.flex\b/ },
  { label: '.flex-col', pattern: /\.flex-col\b/ },
  { label: 'html selector', pattern: /(^|[,\s])html(?=[\s,{:.#\[]|$)/ },
  { label: 'body selector', pattern: /(^|[,\s])body(?=[\s,{:.#\[]|$)/ },
  { label: ':root selector', pattern: /:root\b/ },
  { label: '@layer utilities', pattern: /@layer\s+utilities\b/ },
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(nextPath));
      continue;
    }
    files.push(nextPath);
  }
  return files;
}

function relative(filePath) {
  return path.relative(root, filePath) || filePath;
}

async function checkPluginFrontends() {
  const pluginDirs = await readdir(pluginPackagesRoot, { withFileTypes: true });
  const violations = [];

  for (const entry of pluginDirs) {
    if (!entry.isDirectory()) continue;
    const packageRoot = path.join(pluginPackagesRoot, entry.name);
    const packageJsonPath = path.join(packageRoot, 'package.json');

    try {
      await access(packageJsonPath);
      const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      if (!pkg.urucFrontend) {
        continue;
      }

      const frontendEntry = pkg.urucFrontend.entry;
      const frontendPath = path.join(packageRoot, frontendEntry.replace(/^\.\//, ''));
      const frontendText = await readFile(frontendPath, 'utf8');
      const entryCssImports = [...frontendText.matchAll(cssImportPattern)];
      for (const match of entryCssImports) {
        violations.push(`${relative(frontendPath)} directly imports stylesheet '${match[1]}'; declare route styles with a ?inline loader so CSS is injected into the plugin shadow root`);
      }
      const pluginIdMatch = frontendText.match(/pluginId:\s*['"`]([^'"`]+)['"`]/);
      if (!pluginIdMatch) {
        violations.push(`${relative(frontendPath)} must declare a literal pluginId`);
      } else if (pluginIdMatch[1] !== pkg.urucPlugin?.pluginId) {
        violations.push(`${relative(frontendPath)} pluginId '${pluginIdMatch[1]}' does not match ${pkg.urucPlugin?.pluginId ?? 'package.json#urucPlugin.pluginId'}`);
      }

      if (!String(pkg.urucPlugin?.pluginId ?? '').includes('.')) {
        violations.push(`${relative(packageJsonPath)} must use a namespaced urucPlugin.pluginId`);
      }

      const locationMatches = [...frontendText.matchAll(/locationId:\s*['"`]([^'"`]+)['"`]/g)];
      for (const match of locationMatches) {
        if (!match[1].includes('.')) {
          violations.push(`${relative(frontendPath)} uses non-namespaced locationId '${match[1]}'`);
        }
      }

      if (/\bpath\s*:/.test(frontendText)) {
        violations.push(`${relative(frontendPath)} still declares raw path fields; use pathSegment + aliases`);
      }

      const files = await walk(path.join(packageRoot, 'frontend'));
      for (const file of files) {
        if (!/\.(ts|tsx|mts|cts|js|jsx)$/.test(file)) continue;
        const text = await readFile(file, 'utf8');
        const cssImports = [...text.matchAll(cssImportPattern)];
        for (const match of cssImports) {
          const cssFile = path.resolve(path.dirname(file), match[1].replace(/\?.*$/, ''));
          let cssText = '';
          try {
            cssText = await readFile(cssFile, 'utf8');
          } catch {
            cssText = '';
          }
          const globalPattern = forbiddenGlobalCssPatterns.find((item) => item.pattern.test(cssText));
          if (globalPattern) {
            violations.push(`${relative(file)} directly imports stylesheet '${match[1]}' containing global selector '${globalPattern.label}'; plugin CSS with global selectors must be shadow-only`);
          }
        }
        for (const snippet of forbiddenImportSnippets) {
          if (text.includes(snippet)) {
            violations.push(`${relative(file)} imports forbidden host path fragment '${snippet}'`);
          }
        }
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      violations.push(`${relative(packageRoot)} has urucFrontend metadata but the frontend entry could not be read`);
    }
  }

  return violations;
}

async function checkCoreFiles() {
  const violations = [];
  const coreTypes = await readFile(coreTypesFile, 'utf8');
  const coreApi = await readFile(coreApiFile, 'utf8');

  for (const token of ['Chess', 'Arcade', 'Market', 'Marketplace']) {
    if (coreTypes.includes(token)) {
      violations.push(`${relative(coreTypesFile)} still contains plugin domain token '${token}'`);
    }
  }

  if (coreApi.includes('MarketplaceAdminApi')) {
    violations.push(`${relative(coreApiFile)} still exports MarketplaceAdminApi`);
  }

  const registry = await readFile(registryFile, 'utf8');
  if (registry.includes('server/src/plugins')) {
    violations.push(`${relative(registryFile)} still references the legacy server plugin source tree`);
  }
  if (registry.includes('ensureRuntimeStylesheet') || /rel\s*=\s*['"]stylesheet['"][\s\S]{0,500}document\.head/.test(registry)) {
    violations.push(`${relative(registryFile)} must not inject plugin stylesheets into document.head; pass CSS URLs to the isolated plugin route host`);
  }

  const pluginRouteElement = await readFile(pluginRouteElementFile, 'utf8');
  if (!pluginRouteElement.includes('attachShadow({ mode: \'open\' })') && !pluginRouteElement.includes('attachShadow({ mode: "open" })')) {
    violations.push(`${relative(pluginRouteElementFile)} must render plugin pages inside an open shadow root`);
  }
  if (!pluginRouteElement.includes('data-uruc-plugin-portal-root')) {
    violations.push(`${relative(pluginRouteElementFile)} must provide a plugin-local portal root for overlays`);
  }

  return violations;
}

const violations = [
  ...await checkPluginFrontends(),
  ...await checkCoreFiles(),
];

if (violations.length) {
  console.error('Plugin boundary check failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Plugin boundary check passed.');
