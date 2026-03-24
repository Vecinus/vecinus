import { create } from 'zustand';

import { API_URL, clearGlobalJwtToken, globalJwtToken, setGlobalJwtToken } from '../constants/api';
import { useCommunityStore } from './useCommunityStore';
import { useMembersStore } from './useMembersStore';
import { usePropertyStore } from './usePropertyStore';
import { useUserStore } from './useUserStore';

interface AuthState {
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  validateSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!globalJwtToken,
  isRestoringSession: false,
  token: globalJwtToken,

  login: async (token) => {
    setGlobalJwtToken(token);
    set({ isAuthenticated: true, token });

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        useUserStore.getState().setUser({
          id: userData.id,
          name: userData.username || userData.email.split('@')[0],
          email: userData.email,
          avatar: userData.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error fetching user profile during login:', error);
    }
  },

  logout: () => {
    clearGlobalJwtToken();

    useUserStore.getState().reset();
    useCommunityStore.getState().reset();
    useMembersStore.getState().reset();
    usePropertyStore.getState().reset();

    set({ isAuthenticated: false, token: null, isRestoringSession: false });
  },

  validateSession: async () => {
    const token = globalJwtToken;

    if (!token) {
      set({ isAuthenticated: false, token: null, isRestoringSession: false });
      return;
    }

    set({ isRestoringSession: true });

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Session validation failed with status ${response.status}`);
      }

      const userData = await response.json();
      useUserStore.getState().setUser({
        id: userData.id,
        name: userData.username || userData.email.split('@')[0],
        email: userData.email,
        avatar: userData.avatar_url,
      });

      set({ isAuthenticated: true, token, isRestoringSession: false });
    } catch (error) {
      console.warn('Stored session is invalid or expired. Clearing local session.', error);
      clearGlobalJwtToken();

      useUserStore.getState().reset();
      useCommunityStore.getState().reset();
      useMembersStore.getState().reset();
      usePropertyStore.getState().reset();

      set({ isAuthenticated: false, token: null, isRestoringSession: false });
    }
  },
}));
