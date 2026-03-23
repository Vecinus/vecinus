import { create } from 'zustand';
import { API_URL, clearGlobalJwtToken, setGlobalJwtToken, globalJwtToken } from '../constants/api';
import { useCommunityStore } from './useCommunityStore';
import { useUserStore } from './useUserStore';
import { useMembersStore } from './useMembersStore';
import { usePropertyStore } from './usePropertyStore';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Inicialización síncrona instantánea
  isAuthenticated: !!globalJwtToken,
  token: globalJwtToken,

  login: async (token) => {
    setGlobalJwtToken(token); // Esto ya guarda en disco (MMKV/Local) síncronamente
    
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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

    set({ isAuthenticated: true, token });
  },

  logout: () => {
    clearGlobalJwtToken(); // Esto ya borra de disco (MMKV/Local) síncronamente
    
    // Reset all stores
    useUserStore.getState().reset();
    useCommunityStore.getState().reset();
    useMembersStore.getState().reset();
    usePropertyStore.getState().reset();
    
    set({ isAuthenticated: false, token: null });
  },
}));
