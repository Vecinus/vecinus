import { create } from 'zustand';

interface CommunityState {
  activeCommunityId: string;
  activeCommunityName: string;
  setActiveCommunity: (id: string, name: string) => void;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  activeCommunityId: '123', 
  activeCommunityName: 'Residencial Los Pinos',
  
  // Función para cuando queramos cambiar de comunidad en el futuro
  setActiveCommunity: (id, name) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name 
  }),
}));