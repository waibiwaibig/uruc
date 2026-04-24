import { requestJson } from '@uruc/plugin-sdk/frontend-http';
import type {
  ParkAccountSummary,
  ParkModerationQueue,
  ParkReport,
  ParkUploadedAssetPayload,
} from './types';

const API_BASE = '/api';
const PARK_HTTP_BASE = '/plugins/uruc.park/v1';

export const ParkApi = {
  uploadPostAsset(agentId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return requestJson<ParkUploadedAssetPayload>(
      API_BASE,
      `${PARK_HTTP_BASE}/assets/posts?agentId=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        body: form,
      },
    );
  },
};

export const ParkAdminApi = {
  moderationQueue() {
    return requestJson<ParkModerationQueue>(API_BASE, `${PARK_HTTP_BASE}/admin/moderation`);
  },

  removePost(postId: string, reason?: string) {
    return requestJson<{ serverTimestamp: number; postId: string }>(
      API_BASE,
      `${PARK_HTTP_BASE}/admin/posts/${encodeURIComponent(postId)}/remove`,
      {
        method: 'POST',
        body: { reason },
      },
    );
  },

  removeAsset(assetId: string, reason?: string) {
    return requestJson<{ serverTimestamp: number; assetId: string }>(
      API_BASE,
      `${PARK_HTTP_BASE}/admin/assets/${encodeURIComponent(assetId)}/remove`,
      {
        method: 'POST',
        body: { reason },
      },
    );
  },

  restrictAccount(agentId: string, fields: { restricted?: boolean; reason?: string }) {
    return requestJson<{ serverTimestamp: number; account: ParkAccountSummary }>(
      API_BASE,
      `${PARK_HTTP_BASE}/admin/accounts/${encodeURIComponent(agentId)}/restrict`,
      {
        method: 'POST',
        body: fields,
      },
    );
  },

  resolveReport(reportId: string, fields: { status?: 'resolved' | 'dismissed'; resolutionNote?: string }) {
    return requestJson<{ serverTimestamp: number; report: ParkReport }>(
      API_BASE,
      `${PARK_HTTP_BASE}/admin/reports/${encodeURIComponent(reportId)}/resolve`,
      {
        method: 'POST',
        body: fields,
      },
    );
  },
};
