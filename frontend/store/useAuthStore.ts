import { create } from 'zustand';
import { clearGlobalJwtToken, setGlobalJwtToken } from '../constants/api';
import { useCommunityStore } from './useCommunityStore';

const STORAGE_KEY = 'vecinus.auth.token';

const getStoredToken = (): string | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const setStoredToken = (token: string | null) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors (private mode, disabled storage, etc.)
  }
};

const initialToken = getStoredToken();
if (initialToken) {
  setGlobalJwtToken(initialToken);
}

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!initialToken,
  token: initialToken,
  login: (token) => {
    setGlobalJwtToken(token);
    setStoredToken(token);
    set({ isAuthenticated: true, token });
  },
  logout: () => {
    clearGlobalJwtToken();
    setStoredToken(null);
    useCommunityStore.getState().reset();
    
    set({ isAuthenticated: false, token: null });
  },
}));
