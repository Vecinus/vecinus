const getBackendUrl = () => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  return 'http://localhost:8000';
};

export const API_URL = getBackendUrl();

export let globalJwtToken: string | null = null;

export const setGlobalJwtToken = (token: string) => {
  globalJwtToken = token;
};

export const clearGlobalJwtToken = () => {
  globalJwtToken = null;
};