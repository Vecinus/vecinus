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
      // FIX: Codificar el parámetro para evitar advertencias de SSRF en Codacy
      const safeCommunityId = encodeURIComponent(communityId);
      const response = await fetch(`${API_URL}/${safeCommunityId}/properties/available`, {
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
      // FIX: Codificar el parámetro para evitar advertencias de SSRF en Codacy
      const safeCommunityId = encodeURIComponent(communityId);
      const response = await fetch(`${API_URL}/${safeCommunityId}/properties`, {
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