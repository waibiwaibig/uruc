import { requestJson } from '@uruc/plugin-sdk/frontend-http';
import type { ParkAssetUploadPayload, ParkModerationPayload } from './types';

const API_BASE = '/api';
const PLUGIN_HTTP_BASE = '/plugins/uruc.park/v1';

export const PARK_COMMAND = (id: string) => `uruc.park.${id}@v1`;

export const ParkApi = {
  uploadPostAsset(agentId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return requestJson<ParkAssetUploadPayload>(
      API_BASE,
      `${PLUGIN_HTTP_BASE}/assets/posts?agentId=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        body: form,
      },
    );
  },
  getModerationQueue() {
    return requestJson<ParkModerationPayload>(API_BASE, `${PLUGIN_HTTP_BASE}/admin/moderation`);
  },
  removePost(postId: string, reason: string) {
    return requestJson<{ postId: string }>(
      API_BASE,
      `${PLUGIN_HTTP_BASE}/admin/posts/${encodeURIComponent(postId)}/remove`,
      {
        method: 'POST',
        body: { reason },
      },
    );
  },
  removeAsset(assetId: string, reason: string) {
    return requestJson<{ assetId: string }>(
      API_BASE,
      `${PLUGIN_HTTP_BASE}/admin/assets/${encodeURIComponent(assetId)}/remove`,
      {
        method: 'POST',
        body: { reason },
      },
    );
  },
  restrictAccount(agentId: string, restricted: boolean, reason: string) {
    return requestJson<{ account: unknown }>(
      API_BASE,
      `${PLUGIN_HTTP_BASE}/admin/accounts/${encodeURIComponent(agentId)}/restrict`,
      {
        method: 'POST',
        body: { restricted, reason },
      },
    );
  },
  resolveReport(reportId: string, status: 'resolved' | 'dismissed', resolutionNote: string) {
    return requestJson<{ report: unknown }>(
      API_BASE,
      `${PLUGIN_HTTP_BASE}/admin/reports/${encodeURIComponent(reportId)}/resolve`,
      {
        method: 'POST',
        body: { status, resolutionNote },
      },
    );
  },
};
