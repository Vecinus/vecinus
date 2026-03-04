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
    try {
      const token = process.env.EXPO_PUBLIC_TEST_JWT;
      const response = await fetch(`${API_URL}/${communityId}/properties/available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      set({ availableProperties: data });
    } catch (error) {
      console.error("Error obteniendo propiedades", error);
    }
  }
}));