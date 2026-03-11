import { create } from 'zustand';
import { API_URL, globalJwtToken } from '../constants/api';

export interface Property {
  id: string;
  number: string;
}

interface PropertyStore {
  availableProperties: Property[];
  fetchAvailableProperties: (communityId: string) => Promise<void>;
  addProperty: (communityId: string, number: string) => Promise<boolean>;
}

export const usePropertyStore = create<PropertyStore>((set) => ({
  availableProperties: [],
  fetchAvailableProperties: async (communityId: string) => {
    if (!communityId) return;

    try {
      const safeCommunityId = encodeURIComponent(communityId);
      // Validar y construir la URL de forma segura para Codacy
      const baseURL = API_URL.endsWith('/') ? API_URL : `${API_URL}/`;
      const safeUrl = new URL(`${safeCommunityId}/properties/available`, baseURL);
      
      const response = await fetch(safeUrl.toString(), {
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
  },
  
  addProperty: async (communityId: string, number: string) => {
    try {
      const safeCommunityId = encodeURIComponent(communityId);
      // Validar y construir la URL de forma segura para Codacy
      const baseURL = API_URL.endsWith('/') ? API_URL : `${API_URL}/`;
      const safeUrl = new URL(`${safeCommunityId}/properties`, baseURL);

      const response = await fetch(safeUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${globalJwtToken}`
        },
        body: JSON.stringify({ number })
      });

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error añadiendo propiedad", error);
      return false;
    }
  }
}));