import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'src');
const targets = [
  'components/AppShell.tsx',
  'components/PublicShell.tsx',
  'components/GameShell.tsx',
  'components/LanguageToggle.tsx',
  'components/ProtectedRoute.tsx',
  'pages/IntroPage.tsx',
  'pages/LoginPage.tsx',
  'pages/RegisterPage.tsx',
  'pages/VerifyEmailPage.tsx',
  'pages/AuthCallbackPage.tsx',
  'pages/LobbyPage.tsx',
  'pages/AgentConsolePage.tsx',
  'pages/DeveloperRuntimePage.tsx',
  'pages/PlayPage.tsx',
  'lib/api.ts',
  'lib/ws.ts',
  'lib/storage.ts',
  'lib/error-text.ts',
  'context/AgentsContext.tsx',
  'context/AgentRuntimeContext.tsx',
  'context/AuthContext.tsx',
];

const han = /[\u4e00-\u9fff]/;
const offenders = [];

for (const relativePath of targets) {
  const path = resolve(root, relativePath);
  const source = await readFile(path, 'utf8');
  if (han.test(source)) {
    offenders.push(relativePath);
  }
}

if (offenders.length > 0) {
  console.error('Found hardcoded Chinese in infrastructure files:');
  offenders.forEach((path) => console.error(`- ${path}`));
  process.exit(1);
}

console.log('Infrastructure i18n guard passed.');
