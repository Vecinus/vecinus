import { create } from 'zustand';
import { clearGlobalJwtToken, setGlobalJwtToken } from '../constants/api';
import { useCommunityStore } from './useCommunityStore';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  token: null,
  login: (token) => {
    setGlobalJwtToken(token);
    set({ isAuthenticated: true, token });
  },
  logout: () => {
    clearGlobalJwtToken();
    useCommunityStore.getState().reset();
    
    set({ isAuthenticated: false, token: null });
  },
}));
