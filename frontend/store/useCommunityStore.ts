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
  currentUserId?: string;
  communities: Community[];
  isLoading: boolean;
  error: string | null;
  
  setActiveCommunity: (id: string, name: string, address: string, role: number) => void;
  fetchCommunities: () => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set,get) => ({
  activeCommunityId: null, 
  activeCommunityName: null,
  activeCommunityAddress: null,
  activeCommunityRole: null,
  communities: [],
  isLoading: false,
  error: null,
  
  setActiveCommunity: (id, name, address, role) => set({ 
    activeCommunityId: id, 
    activeCommunityName: name,
    activeCommunityAddress: address,
    activeCommunityRole: role,
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