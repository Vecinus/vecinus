// Implementación Síncrona Exclusiva para WEB
// React Native / Expo usará este archivo automáticamente cuando compiles para Web

interface SyncStorage {
  set: (key: string, value: string) => void;
  getString: (key: string) => string | undefined;
  delete: (key: string) => void;
  clear: () => void;
}

export const storage: SyncStorage = {
  set: (key, value) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  getString: (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key) || undefined;
    }
    return undefined;
  },
  delete: (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
  clear: () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  }
};
