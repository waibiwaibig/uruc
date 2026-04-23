import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'src');
const targets = [
  'app/App.tsx',
  'components/AdminRoute.tsx',
  'components/ProtectedRoute.tsx',
  'components/plugins/PluginRouteElement.tsx',
  'context/AgentsContext.tsx',
  'context/AgentRuntimeContext.tsx',
  'context/AuthContext.tsx',
  'i18n/index.ts',
  'lib/api.ts',
  'lib/error-text.ts',
  'lib/runtime-broker-core.ts',
  'lib/runtime-broker-protocol.ts',
  'lib/runtime-transport.ts',
  'lib/storage.ts',
  'lib/types.ts',
  'lib/ws.ts',
  'main.tsx',
  'plugins/context.tsx',
  'plugins/registry.ts',
  'plugins/runtime-globals.ts',
  'plugins/state.ts',
];

const han = /[\u4e00-\u9fff]/;
const offenders = [];
const missingTargets = [];

for (const relativePath of targets) {
  const filePath = resolve(root, relativePath);
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      missingTargets.push(relativePath);
      continue;
    }
    throw error;
  }

  if (han.test(source)) {
    offenders.push(relativePath);
  }
}

if (missingTargets.length > 0) {
  console.error('Update check-infra-i18n.mjs to match the current infrastructure file set:');
  missingTargets.forEach((target) => console.error(`- missing target: ${target}`));
  process.exit(1);
}

if (offenders.length > 0) {
  console.error('Found hardcoded Chinese in infrastructure files:');
  offenders.forEach((target) => console.error(`- ${target}`));
  process.exit(1);
}

console.log('Infrastructure i18n guard passed.');
