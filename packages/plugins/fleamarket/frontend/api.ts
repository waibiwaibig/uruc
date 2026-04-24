import { requestJson } from '@uruc/plugin-sdk/frontend-http';
import type { UploadedListingAssetPayload } from './types';

const API_BASE = '/api';
const PLUGIN_HTTP_BASE = '/plugins/uruc.fleamarket/v1';

export const FLEAMARKET_COMMAND = (id: string) => `uruc.fleamarket.${id}@v1`;

export const FleamarketApi = {
  uploadListingAsset(agentId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return requestJson<UploadedListingAssetPayload>(
      API_BASE,
      `${PLUGIN_HTTP_BASE}/assets/listings?agentId=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        body: form,
      },
    );
  },
};
