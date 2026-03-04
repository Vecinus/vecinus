import { create } from 'zustand';
import { API_URL } from '../constants/api';

export interface Property {
  id: string;
  number: string;
}

interface PropertyStore {
  availableProperties: Property[];
  fetchAvailableProperties: (communityId: string) => Promise<void>;
}

export const usePropertyStore = create<PropertyStore>((set) => ({
  availableProperties: [],
  fetchAvailableProperties: async (communityId: string) => {
    if (!communityId) return;

    try {
      const token = process.env.EXPO_PUBLIC_TEST_JWT;
      const response = await fetch(`${API_URL}/${communityId}/properties/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
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