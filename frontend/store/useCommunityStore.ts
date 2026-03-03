import { create } from 'zustand';

interface Community {
  id: string;
  name: string;
}

interface CommunityState {
  // La lista de todas las comunidades (el mock)
  communities: Community[];
  // La que está seleccionada actualmente
  activeCommunityId: string;
  activeCommunityName: string;
  // Función para cambiar la selección
  setActiveCommunity: (id: string, name: string) => void;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  // 1. Aquí metes todas las que quieras que salgan en el desplegable
  communities: [
    { id: '123', name: 'Residencial Los Pinos' },
    { id: '122', name: 'Residencial Vecinus' },
    { id: '121', name: 'Urbanización La Paz' },
  ],

  // 2. Estado inicial (por defecto la primera)
  activeCommunityId: '123', 
  activeCommunityName: 'Residencial Los Pinos',
  
  setActiveCommunity: (id, name) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name 
  }),
}));