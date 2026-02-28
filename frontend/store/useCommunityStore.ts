import { create } from 'zustand';

// 1. Definimos qué forma tiene nuestra memoria
interface CommunityState {
  activeCommunityId: string;
  activeCommunityName: string;
  setActiveCommunity: (id: string, name: string) => void;
}

// 2. Creamos la memoria con nuestros datos "Mockeados" (de mentira)
export const useCommunityStore = create<CommunityState>((set) => ({
  activeCommunityId: '123', // ID falso simulando lo que nos daría el Backend
  activeCommunityName: 'Residencial Los Pinos', // Nombre falso
  
  // Función para cuando queramos cambiar de comunidad en el futuro
  setActiveCommunity: (id, name) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name 
  }),
}));