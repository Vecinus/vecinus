import axios from 'axios';
import { storageService } from './services/storage.service';
import { notifyUnauthorized } from '@/lib/auth-events';

const getBackendUrl = () => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  // Fallback por defecto si se te olvida crear el archivo .env
  return 'http://localhost:8000';
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

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? '').toLowerCase();
    const isAuthPublicEndpoint = requestUrl.includes('/login') || requestUrl.includes('/logout');

    if (status === 401 && !isAuthPublicEndpoint) {
      await notifyUnauthorized();
    }

    return Promise.reject(error);
  }
);
