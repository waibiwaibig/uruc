import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import { AuthProvider } from './context/AuthContext';
import { AgentsProvider } from './context/AgentsContext';
import { AgentRuntimeProvider } from './context/AgentRuntimeContext';
import './styles/base.css';
import './styles/app.css';
import './styles/auth.css';
import './styles/console.css';
import './styles/city.css';
import './styles/game.css';
import './styles/utilities.css';
import './styles/chess.css';
import './styles/arcade.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AgentsProvider>
        <AgentRuntimeProvider>
          <App />
        </AgentRuntimeProvider>
      </AgentsProvider>
    </AuthProvider>
  </StrictMode>,
);
