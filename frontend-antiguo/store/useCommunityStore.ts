import { create } from 'zustand';
import { API_URL, globalJwtToken } from '../constants/api';
import { storage } from './storage';

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
  communities: Community[];
  isLoading: boolean;
  error: string | null;
  
  setActiveCommunity: (id: string, name: string, address?: string, role?: number) => void;
  setCommunities: (communities: Community[]) => void;
  fetchCommunities: () => Promise<void>;
  reset: () => void;
}

// Helpers para cargar/guardar en disco
const getStoredCommunities = (): Community[] => {
  const data = storage.getString('user-communities');
  return data ? JSON.parse(data) : [];
};

const getStoredActiveCommunity = () => {
  const data = storage.getString('active-community');
  return data ? JSON.parse(data) : { id: null, name: null, address: null, role: null };
};

export const useCommunityStore = create<CommunityState>((set, get) => ({
  ...getStoredActiveCommunity(),
  communities: getStoredCommunities(),
  isLoading: false,
  error: null,

  setActiveCommunity: (id, name, address, role) => {
    const activeData = { 
      activeCommunityId: id, 
      activeCommunityName: name,
      activeCommunityAddress: address || null,
      activeCommunityRole: role ?? null,
    };
    storage.set('active-community', JSON.stringify(activeData));
    set(activeData);
  },

  setCommunities: (communities) => {
    storage.set('user-communities', JSON.stringify(communities));
    set({ communities });
  },
  
  reset: () => {
    storage.delete('user-communities');
    storage.delete('active-community');
    set({
      activeCommunityId: null,
      activeCommunityName: null,
      activeCommunityAddress: null,
      activeCommunityRole: null,
      communities: [],
      isLoading: false,
      error: null,
    });
  },

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
      
      const newState = { 
        communities: formattedCommunities, 
        isLoading: false,
        activeCommunityId: communityToSet?.id || null,
        activeCommunityName: communityToSet?.name || null,
        activeCommunityAddress: communityToSet?.address || null,
        activeCommunityRole: communityToSet?.role || null,
      };

      // Guardamos en disco
      storage.set('user-communities', JSON.stringify(formattedCommunities));
      storage.set('active-community', JSON.stringify({
        activeCommunityId: newState.activeCommunityId,
        activeCommunityName: newState.activeCommunityName,
        activeCommunityAddress: newState.activeCommunityAddress,
        activeCommunityRole: newState.activeCommunityRole
      }));

      set(newState);
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        set({ isLoading: false, error: error.message });
      } else {
        set({ isLoading: false, error: 'Ocurrió un error desconocido' });
      }
    }
  }
}));
