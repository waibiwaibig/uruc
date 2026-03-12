import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DashboardApi } from '../lib/api';
import i18n from '../i18n';
import { getSelectedAgentId, setSelectedAgentId as persistSelectedAgent } from '../lib/storage';
import type { Agent } from '../lib/types';
import { useAuth } from './AuthContext';

interface AgentsContextValue {
  loading: boolean;
  error: string;
  agents: Agent[];
  shadowAgent: Agent | null;
  selectedAgentId: string | null;
  selectedAgent: Agent | null;
  setSelectedAgentId: (agentId: string | null) => void;
  reloadAgents: () => Promise<void>;
  createAgent: (name: string) => Promise<Agent>;
  updateAgent: (agentId: string, fields: { name?: string; description?: string; searchable?: boolean; trustMode?: 'confirm' | 'full' }) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  getAllowedLocations: (agentId: string) => Promise<string[]>;
  setAllowedLocations: (agentId: string, allowedLocations: string[]) => Promise<void>;
}

const AgentsContext = createContext<AgentsContextValue | null>(null);

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentIdState] = useState<string | null>(() => getSelectedAgentId());

  const setSelectedAgentId = (agentId: string | null) => {
    setSelectedAgentIdState(agentId);
    persistSelectedAgent(agentId);
  };

  const reloadAgents = useCallback(async () => {
    if (!user) {
      setAgents([]);
      setSelectedAgentId(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await DashboardApi.listAgents();
      setAgents(res.agents);

      if (res.agents.length === 0) {
        setSelectedAgentId(null);
      } else if (!selectedAgentId || !res.agents.some((agent) => agent.id === selectedAgentId)) {
        setSelectedAgentId(res.agents[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('dashboard:agents.loadFailure'));
    } finally {
      setLoading(false);
    }
  }, [user, selectedAgentId]);

  useEffect(() => {
    if (!ready) return;
    void reloadAgents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  const createAgent = useCallback(async (name: string) => {
    const hadSelection = selectedAgentId;
    const res = await DashboardApi.createAgent(name);
    await reloadAgents();
    if (!hadSelection) {
      setSelectedAgentId(res.agent.id);
    }
    return res.agent;
  }, [reloadAgents, selectedAgentId]);

  const updateAgent = useCallback(async (agentId: string, fields: { name?: string; description?: string; searchable?: boolean; trustMode?: 'confirm' | 'full' }) => {
    await DashboardApi.updateAgent(agentId, fields);
    await reloadAgents();
  }, [reloadAgents]);

  const deleteAgent = useCallback(async (agentId: string) => {
    await DashboardApi.deleteAgent(agentId);
    await reloadAgents();
  }, [reloadAgents]);

  const getAllowedLocations = useCallback(async (agentId: string) => {
    const res = await DashboardApi.getAgentLocations(agentId);
    return res.allowedLocations;
  }, []);

  const setAllowedLocations = useCallback(async (agentId: string, allowedLocations: string[]) => {
    await DashboardApi.updateAgentLocations(agentId, allowedLocations);
    await reloadAgents();
  }, [reloadAgents]);

  const shadowAgent = agents.find((agent) => agent.isShadow) ?? null;
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const value = useMemo<AgentsContextValue>(
    () => ({
      loading,
      error,
      agents,
      shadowAgent,
      selectedAgentId,
      selectedAgent,
      setSelectedAgentId,
      reloadAgents,
      createAgent,
      updateAgent,
      deleteAgent,
      getAllowedLocations,
      setAllowedLocations,
    }),
    [
      loading,
      error,
      agents,
      shadowAgent,
      selectedAgentId,
      selectedAgent,
      reloadAgents,
      createAgent,
      updateAgent,
      deleteAgent,
      getAllowedLocations,
      setAllowedLocations,
    ],
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

export function useAgents(): AgentsContextValue {
  const ctx = useContext(AgentsContext);
  if (!ctx) {
    throw new Error('useAgents must be used within AgentsProvider');
  }
  return ctx;
}
