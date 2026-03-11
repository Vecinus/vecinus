import { create } from 'zustand';
import { API_URL, globalJwtToken } from '../constants/api';

export interface Property {
  id: string;
  number: string;
}

interface PropertyStore {
  availableProperties: Property[];
  fetchAvailableProperties: (communityId: string) => Promise<void>;
  addProperty: (communityId: string, number: string) => Promise<boolean>; // <-- Nueva función
}

export const usePropertyStore = create<PropertyStore>((set) => ({
  availableProperties: [],
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
  },
  
  // <-- NUEVA FUNCIÓN PARA AÑADIR PROPIEDAD
  addProperty: async (communityId: string, number: string) => {
    try {
      const response = await fetch(`${API_URL}/${communityId}/properties`, {
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