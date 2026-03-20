import dotenv from 'dotenv';
import { getActiveEnvPath } from './runtime-paths.js';

dotenv.config({ path: getActiveEnvPath(), quiet: true });

import('./main.js')
  .then(({ runMain }) => runMain())
  .catch((err) => {
    console.error('Failed to bootstrap server:', err);
    process.exit(1);
  });
