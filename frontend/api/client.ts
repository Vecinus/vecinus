import axios from 'axios';
import { storageService } from './services/storage.service';
import { notifyUnauthorized } from '@/lib/auth-events';
import { notifyCommunityBlocked } from '@/lib/payment-events';
import type { CommunityBlockedDetail } from '@/types/payments.types';

const getBackendUrl = () => {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!url) {
    if (__DEV__) {
      return 'http://localhost:8000';
    }
    throw new Error('EXPO_PUBLIC_BACKEND_URL is required in production');
  }
  return url;
};

const BASE_URL = getBackendUrl();

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await storageService.getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function isCommunityBlockedDetail(value: unknown): value is CommunityBlockedDetail {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.code === 'community_blocked' || candidate.code === 'community_no_subscription') &&
    typeof candidate.association_id === 'string' &&
    candidate.association_id.length > 0
  );
}

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? '').toLowerCase();
    const isAuthPublicEndpoint = requestUrl.includes('/login') || requestUrl.includes('/logout') || requestUrl.includes('/accept-invitation');

    if (status === 401 && !isAuthPublicEndpoint) {
      await notifyUnauthorized();
    }

    if (status === 402) {
      const detail = error?.response?.data?.detail;
      if (isCommunityBlockedDetail(detail)) {
        void notifyCommunityBlocked(detail);
      }
    }

    // Axios rechaza la promesa automáticamente, TanStack Query lo detectará como error
    return Promise.reject(error);
  }
);
