import { create } from 'zustand';

interface Community {
  id: string;
  name: string;
}

interface CommunityState {
  activeCommunityId: string;
  activeCommunityName: string;
  userToken: string; // Para el JWT
  communities: Community[]; // Lista real de la DB
  setUserToken: (token: string) => void;
  setCommunities: (list: Community[]) => void;
  setActiveCommunity: (id: string, name: string) => void;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  activeCommunityId: '', 
  activeCommunityName: 'Seleccione una comunidad',
  userToken: '',
  communities: [],

  setUserToken: (token) => set({ userToken: token }),
  setCommunities: (list) => set({ communities: list }),
  setActiveCommunity: (id, name) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name 
  }),
}));