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

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let jwtAutoLogoutTimer: ReturnType<typeof setTimeout> | null = null;
let authFetchInterceptorInstalled = false;
let isHandlingExpiredSession = false;

const decodeBase64Url = (value: string): string | null => {
  const decoder = globalThis.atob;

  if (typeof decoder !== 'function') {
    return null;
  }

  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalizedValue.length % 4 || 4)) % 4);

  try {
    return decoder(`${normalizedValue}${padding}`);
  } catch (error) {
    console.warn('No se pudo decodificar el payload del JWT.', error);
    return null;
  }
};

const getAuthorizationHeader = (headers?: HeadersInit): string | null => {
  if (!headers) {
    return null;
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get('Authorization');
  }

  if (Array.isArray(headers)) {
    const headerEntry = headers.find(([key]) => key.toLowerCase() === 'authorization');
    return typeof headerEntry?.[1] === 'string' ? headerEntry[1] : null;
  }

  const headerRecord = headers as Record<string, string | undefined>;
  const headerKey = Object.keys(headerRecord).find((key) => key.toLowerCase() === 'authorization');
  return headerKey ? headerRecord[headerKey] || null : null;
};

const getRequestHeaders = (input: RequestInfo | URL, init?: RequestInit): HeadersInit | undefined => {
  if (init?.headers) {
    return init.headers;
  }

  if (typeof input === 'object' && input !== null && 'headers' in input) {
    return (input as Request).headers;
  }

  return undefined;
};

const isAuthenticatedRequest = (input: RequestInfo | URL, init?: RequestInit) => {
  const authorizationHeader = getAuthorizationHeader(getRequestHeaders(input, init));
  return typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ');
};

const notifySessionExpired = () => {
  if (!sessionExpiredHandler || isHandlingExpiredSession) {
    return;
  }

  isHandlingExpiredSession = true;

  try {
    sessionExpiredHandler();
  } finally {
    setTimeout(() => {
      isHandlingExpiredSession = false;
    }, 0);
  }
};

export const registerSessionExpiredHandler = (handler: SessionExpiredHandler) => {
  sessionExpiredHandler = handler;
};

export const getJwtExpirationTime = (token: string): number | null => {
  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  const decodedPayload = decodeBase64Url(payload);
  if (!decodedPayload) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(decodedPayload) as { exp?: number };

    if (typeof parsedPayload.exp !== 'number') {
      return null;
    }

    return parsedPayload.exp * 1000;
  } catch (error) {
    console.warn('No se pudo interpretar la expiración del JWT.', error);
    return null;
  }
};

export const isJwtExpired = (token: string, now = Date.now()) => {
  const expirationTime = getJwtExpirationTime(token);
  return expirationTime !== null && expirationTime <= now;
};

export const clearJwtAutoLogout = () => {
  if (jwtAutoLogoutTimer) {
    clearTimeout(jwtAutoLogoutTimer);
    jwtAutoLogoutTimer = null;
  }
};

export const scheduleJwtAutoLogout = (token: string | null) => {
  clearJwtAutoLogout();

  if (!token) {
    return;
  }

  const expirationTime = getJwtExpirationTime(token);
  if (!expirationTime) {
    return;
  }

  const msUntilExpiration = expirationTime - Date.now();

  if (msUntilExpiration <= 0) {
    setTimeout(() => {
      notifySessionExpired();
    }, 0);
    return;
  }

  jwtAutoLogoutTimer = setTimeout(() => {
    notifySessionExpired();
  }, msUntilExpiration);
};

export const installAuthFetchInterceptor = () => {
  if (authFetchInterceptorInstalled || typeof globalThis.fetch !== 'function') {
    return;
  }

  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await nativeFetch(input, init);

    if (response.status === 401 && isAuthenticatedRequest(input, init)) {
      notifySessionExpired();
    }

    return response;
  };

  authFetchInterceptorInstalled = true;
};

export const setGlobalJwtToken = (token: string) => {
  globalJwtToken = token;
  storage.set('auth-token', token);
};

export const clearGlobalJwtToken = () => {
  globalJwtToken = null;
  storage.delete('auth-token');
};
