import { create } from 'zustand';
import { API_URL, globalJwtToken } from '../constants/api';

export interface Property {
  id: string;
  number: string;
}

interface PropertyStore {
  availableProperties: Property[];
  fetchAvailableProperties: (communityId: string) => Promise<void>;
  reset: () => void;
}

export const usePropertyStore = create<PropertyStore>((set) => ({
  availableProperties: [],
  reset: () => set({ availableProperties: [] }),
  fetchAvailableProperties: async (communityId: string) => {
    if (!communityId) return;

    try {
      const response = await fetch(`${API_URL}/${communityId}/properties/available`, {
        headers: { 'Authorization': `Bearer ${globalJwtToken}` }
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las propiedades");
      }

      const data = await response.json();
      
      set({ availableProperties: Array.isArray(data) ? data : [] });
    
    } catch (error) {
      console.error("Error obteniendo propiedades", error);
      set({ availableProperties: [] }); 
    }
  }
}));