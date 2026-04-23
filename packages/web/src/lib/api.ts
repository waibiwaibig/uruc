import type { ActionLog, Agent, FrontendRuntimePluginIndexResponse, HealthResponse, User } from './types';
import { localizeCoreError } from './error-text';

const API_BASE = '/api';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: options.credentials ?? 'same-origin',
    headers,
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const data = payload as { error?: string; code?: string } | null;
    const message = localizeCoreError(data?.code, data?.error, res.status);
    const err = new Error(message) as Error & { code?: string; status?: number };
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }

  return payload as T;
}

export const AuthApi = {
  sendRegistrationCode(email: string) {
    return request<{ success: boolean }>('/auth/send-registration-code', {
      method: 'POST',
      body: { email },
    });
  },

  register(username: string, email: string, password: string, code: string) {
    return request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: { username, email, password, code },
    });
  },

  login(username: string, password: string) {
    return request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  },

  verifyEmail(email: string, code: string) {
    return request<{ user: User }>('/auth/verify-email', {
      method: 'POST',
      body: { email, code },
    });
  },

  resendCode(email: string) {
    return request<{ success: boolean }>('/auth/resend-code', {
      method: 'POST',
      body: { email },
    });
  },

  changePassword(oldPassword: string, newPassword: string) {
    return request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: { oldPassword, newPassword },
    });
  },

  logout() {
    return request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  },
};

export const DashboardApi = {
  me() {
    return request<{ user: User }>('/dashboard/me');
  },

  listAgents() {
    return request<{ agents: Agent[] }>('/dashboard/agents');
  },

  createAgent(name: string) {
    return request<{ agent: Agent }>('/dashboard/agents', {
      method: 'POST',
      body: { name },
    });
  },

  updateAgent(agentId: string, fields: { name?: string; description?: string; searchable?: boolean; trustMode?: 'confirm' | 'full' }) {
    return request<{ success: boolean }>(`/dashboard/agents/${agentId}`, {
      method: 'PATCH',
      body: fields,
    });
  },

  uploadAgentAvatar(agentId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<{ avatarPath: string }>(`/dashboard/agents/${agentId}/avatar`, {
      method: 'POST',
      body: form,
    });
  },

  deleteAgent(agentId: string) {
    return request<{ success: boolean }>(`/dashboard/agents/${agentId}`, {
      method: 'DELETE',
    });
  },

  getAgentLocations(agentId: string) {
    return request<{ allowedLocations: string[] }>(`/dashboard/agents/${agentId}/locations`);
  },

  updateAgentLocations(agentId: string, allowedLocations: string[]) {
    return request<{ success: boolean }>(`/dashboard/agents/${agentId}/locations`, {
      method: 'PATCH',
      body: { allowedLocations },
    });
  },

  listLogs(agentId?: string) {
    const search = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
    return request<{ logs: ActionLog[] }>(`/dashboard/logs${search}`);
  },
};

export const PublicApi = {
  health() {
    return request<HealthResponse>('/health', {
      cache: 'no-store',
    });
  },

  frontendPlugins() {
    return request<FrontendRuntimePluginIndexResponse>('/frontend-plugins', {
      cache: 'no-store',
    });
  },
};
