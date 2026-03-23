import { storage } from '../store/storage';

const getBackendUrl = () => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  return 'http://localhost:8000';
};

export const API_URL = getBackendUrl();

// Cargamos el token inicial de forma síncrona al arrancar la app
export let globalJwtToken: string | null = storage.getString('auth-token') || null;

export const setGlobalJwtToken = (token: string) => {
  globalJwtToken = token;
  storage.set('auth-token', token);
};

export const clearGlobalJwtToken = () => {
  globalJwtToken = null;
  storage.delete('auth-token');
};
