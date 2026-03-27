import axios from 'axios';
import { storageService } from './services/storage.service';
import { Platform } from 'react-native';

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
    if (error.response?.status === 401) {
      console.warn('El token ha expirado o es inválido.');
      // 💡 AQUÍ: Es el lugar perfecto para meter tu lógica de Refresh Token
      // o para limpiar el storageService y mandar al usuario al Login.
    }
    
    // Axios rechaza la promesa automáticamente, TanStack Query lo detectará como error
    return Promise.reject(error);
  }
);