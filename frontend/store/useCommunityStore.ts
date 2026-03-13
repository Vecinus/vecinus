import { create } from 'zustand';
import { API_URL, globalJwtToken } from '../constants/api';

export interface Community {
  id: string; 
  name: string;
  address: string;
  role: number;
}

interface BackendCommunityResponse {
  id: string;
  association_id: string;
  role: number;
  property_id: string;
  joined_at: string;
  neighborhood_associations: {
    id: string;
    name: string;
    address: string;
  };
}

interface CommunityState {
  activeCommunityId: string | null;
  activeCommunityName: string | null;
  activeCommunityAddress: string | null;
  activeCommunityRole: number | null;
  userToken: string | null;            
  currentUserId?: string;
  communities: Community[];
  isLoading: boolean;
  error: string | null;
  
  // CORRECCIÓN: address y role ahora son opcionales con "?" para evitar error TS2554
  setActiveCommunity: (id: string, name: string, address?: string, role?: number) => void;
  setCommunities: (communities: Community[]) => void; // CORRECCIÓN: Añadido para error TS2551
  setUserToken: (token: string | null) => void;      // CORRECCIÓN: Añadido para error TS2339
  fetchCommunities: () => Promise<void>;
  reset: () => void;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  activeCommunityId: null, 
  activeCommunityName: null,
  activeCommunityAddress: null,
  activeCommunityRole: null,
  userToken: null,           // Inicialización
  communities: [],
  isLoading: false,
  error: null,
  
  setActiveCommunity: (id, name, address, role) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name,
    activeCommunityAddress: address || null,
    activeCommunityRole: role || null,
  }),

  // Implementación de las nuevas funciones
  setCommunities: (communities) => set({ communities }),
  setUserToken: (token) => set({ userToken: token }),
  reset: () => set({
    activeCommunityId: null,
    activeCommunityName: null,
    activeCommunityAddress: null,
    activeCommunityRole: null,
    userToken: null,
    currentUserId: undefined,
    communities: [],
    isLoading: false,
    error: null,
  }),

  fetchCommunities: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/users/me/communities`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${globalJwtToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener las comunidades');
      }

      const rawData: BackendCommunityResponse[] = await response.json();
      const formattedCommunities: Community[] = rawData.map(item => ({
        id: item.neighborhood_associations.id,
        name: item.neighborhood_associations.name,
        address: item.neighborhood_associations.address,
        role: item.role
      }));

      const currentActiveId = get().activeCommunityId;
      const stillExists = formattedCommunities.find(c => c.id === currentActiveId);
      const communityToSet = stillExists || (formattedCommunities.length > 0 ? formattedCommunities[0] : null);
      
      set({ 
        communities: formattedCommunities, 
        isLoading: false,
        activeCommunityId: communityToSet?.id || null,
        activeCommunityName: communityToSet?.name || null,
        activeCommunityAddress: communityToSet?.address || null,
        activeCommunityRole: communityToSet?.role || null,
      });
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        set({ isLoading: false, error: error.message });
      } else {
        set({ isLoading: false, error: 'Ocurrió un error desconocido' });
      }
    }
  }
}));
