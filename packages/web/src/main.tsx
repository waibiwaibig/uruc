import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import './i18n';
import { AuthProvider } from './context/AuthContext';
import { AgentsProvider } from './context/AgentsContext';
import { AgentRuntimeProvider } from './context/AgentRuntimeContext';
import { PluginHostProvider } from './plugins/context';
import { installPluginRuntimeGlobals } from './plugins/runtime-globals';
import './styles/index.css';

installPluginRuntimeGlobals();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AgentsProvider>
        <AgentRuntimeProvider>
          <PluginHostProvider>
            <App />
          </PluginHostProvider>
        </AgentRuntimeProvider>
      </AgentsProvider>
    </AuthProvider>
  </StrictMode>,
);
