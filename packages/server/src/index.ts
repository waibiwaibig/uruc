import dotenv from 'dotenv';
import { getEnvPath } from './runtime-paths.js';

dotenv.config({ path: getEnvPath(), quiet: true });

import('./main.js').catch((err) => {
  console.error('Failed to bootstrap server:', err);
  process.exit(1);
});
