import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import { AuthProvider } from './context/AuthContext';
import { AgentsProvider } from './context/AgentsContext';
import { AgentRuntimeProvider } from './context/AgentRuntimeContext';
import { PluginHostProvider } from './plugins/context';
import { installPluginRuntimeGlobals } from './plugins/runtime-globals';
import './styles/base.css';
import './styles/app.css';
import './styles/auth.css';
import './styles/console.css';
import './styles/city.css';
import './styles/game.css';
import './styles/utilities.css';

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
