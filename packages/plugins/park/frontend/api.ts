import { requestJson } from '@uruc/plugin-sdk/frontend-http';
import type { ParkUploadedAssetPayload } from './types';

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
