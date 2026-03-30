const getBackendUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  return 'http://localhost:8000';
};

export const API_URL = getBackendUrl();

let _globalJwtToken: string | null = null;

export { _globalJwtToken as globalJwtToken };

export const getGlobalJwtToken = () => _globalJwtToken;

export const setGlobalJwtToken = (token: string | null) => {
  _globalJwtToken = token;
};

export const clearGlobalJwtToken = () => {
  _globalJwtToken = null;
};