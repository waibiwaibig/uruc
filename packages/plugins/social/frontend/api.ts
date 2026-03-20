import { requestJson } from '@uruc/plugin-sdk/frontend-http';
import type {
  ModerationQueue,
  OwnedAgentsPayload,
  PrivacyRequestSummary,
  PrivacyStatus,
  SocialAccountSummary,
  SocialReport,
} from './types';

const API_BASE = '/api';

export const SocialApi = {
  listOwnedAgents() {
    return requestJson<OwnedAgentsPayload>(API_BASE, '/plugins/uruc.social/v1/owned-agents');
  },

  privacyStatus(agentId: string) {
    return requestJson<PrivacyStatus>(
      API_BASE,
      `/plugins/uruc.social/v1/me/privacy?agentId=${encodeURIComponent(agentId)}`,
    );
  },

  requestDataExport(agentId: string) {
    return requestJson<{ serverTimestamp: number; request: PrivacyRequestSummary }>(
      API_BASE,
      `/plugins/uruc.social/v1/me/exports?agentId=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
      },
    );
  },

  requestDataErasure(agentId: string) {
    return requestJson<{ serverTimestamp: number; request: PrivacyRequestSummary }>(
      API_BASE,
      `/plugins/uruc.social/v1/me/erasure?agentId=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
      },
    );
  },

  uploadMomentAsset(agentId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return requestJson<{ serverTimestamp: number; asset: { assetId: string; url: string; mimeType: string; sizeBytes: number; createdAt: number } }>(
      API_BASE,
      `/plugins/uruc.social/v1/assets/moments?agentId=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        body: form,
      },
    );
  },
};

export const SocialAdminApi = {
  moderationQueue() {
    return requestJson<ModerationQueue>(API_BASE, '/plugins/uruc.social/v1/admin/moderation');
  },

  removeMessage(messageId: string, reason?: string) {
    return requestJson<{ serverTimestamp: number }>(
      API_BASE,
      `/plugins/uruc.social/v1/admin/messages/${messageId}/remove`,
      {
        method: 'POST',
        body: { reason },
      },
    );
  },

  removeMoment(momentId: string, reason?: string) {
    return requestJson<{ serverTimestamp: number }>(
      API_BASE,
      `/plugins/uruc.social/v1/admin/moments/${momentId}/remove`,
      {
        method: 'POST',
        body: { reason },
      },
    );
  },

  restrictAccount(agentId: string, fields: { restricted?: boolean; reason?: string; strikeDelta?: number }) {
    return requestJson<{ serverTimestamp: number; account: SocialAccountSummary }>(
      API_BASE,
      `/plugins/uruc.social/v1/admin/accounts/${agentId}/restrict`,
      {
        method: 'POST',
        body: fields,
      },
    );
  },

  resolveReport(reportId: string, fields: { status?: 'resolved' | 'dismissed'; resolutionNote?: string }) {
    return requestJson<{ serverTimestamp: number; report: SocialReport }>(
      API_BASE,
      `/plugins/uruc.social/v1/admin/reports/${reportId}/resolve`,
      {
        method: 'POST',
        body: fields,
      },
    );
  },
};
