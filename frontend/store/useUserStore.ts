import { create } from 'zustand';
import { storage } from './storage';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

interface UserState {
  profile: UserProfile | null;
  setUser: (profile: UserProfile | null) => void;
  reset: () => void;
}

// Intentamos recuperar el perfil del disco al arrancar
const getStoredProfile = (): UserProfile | null => {
  const data = storage.getString('user-profile');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const useUserStore = create<UserState>((set) => ({
  profile: getStoredProfile(),

  setUser: (profile) => {
    if (profile) {
      storage.set('user-profile', JSON.stringify(profile));
    } else {
      storage.delete('user-profile');
    }
    set({ profile });
  },

  reset: () => {
    storage.delete('user-profile');
    set({ profile: null });
  },
}));
