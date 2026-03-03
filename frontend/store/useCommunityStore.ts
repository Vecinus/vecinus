import { create } from 'zustand';
import { API_URL } from '../constants/api';

export interface Community {
  id: string; 
  name: string;
  address: string;
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
  communities: Community[];
  isLoading: boolean;
  error: string | null;
  activeCommunityAddress: string | null;
  
  setActiveCommunity: (id: string, name: string, address: string) => void;
  fetchCommunities: () => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  activeCommunityId: null, 
  activeCommunityName: null,
  activeCommunityAddress: null,
  communities: [],
  isLoading: false,
  error: null,
  
  setActiveCommunity: (id, name, address) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name,
    activeCommunityAddress: address,
  }),

  fetchCommunities: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = process.env.EXPO_PUBLIC_TEST_JWT;
      
      if (!token) throw new Error("No hay JWT configurado");
      
      const response = await fetch(`${API_URL}/users/me/communities`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
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
        address: item.neighborhood_associations.address
      }));
      
      set({ 
        communities: formattedCommunities, 
        isLoading: false,
        activeCommunityId: formattedCommunities.length > 0 ? formattedCommunities[0].id : null,
        activeCommunityName: formattedCommunities.length > 0 ? formattedCommunities[0].name : null,
        activeCommunityAddress: formattedCommunities.length > 0 ? formattedCommunities[0].address : null,
      });
      
    } catch (error: any) {
      console.error("Error en fetchCommunities:", error);
      set({ isLoading: false, error: error.message });
    }
  }
}));