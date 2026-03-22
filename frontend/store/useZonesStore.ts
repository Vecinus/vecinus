import { create } from 'zustand';
import { API_URL } from '../constants/api';
import { useAuthStore } from './useAuthStore';

export interface ZonaComun {
  id: string;
  nombre: string;
  aforo: number;
  requiereQR: boolean;
  horaInicio: string;
  horaFin: string;
}

export interface Reserva {
  id: string;
  zonaId: string;
  zonaNombre: string;
  fecha: string;
  hora: string;
  requiereQR: boolean;
}

interface ZonasState {
  zonas: ZonaComun[];
  misReservas: Reserva[];
  isLoading: boolean;
  fetchZonas: (comunidadId: string) => Promise<void>;
  crearZona: (comunidadId: string, zona: Partial<ZonaComun>) => Promise<void>;
  crearReserva: (reserva: Omit<Reserva, 'id'>) => Promise<string>;
  obtenerReservaPorId: (id: string) => Reserva | undefined;
}

export const useZonasStore = create<ZonasState>((set, get) => ({
  zonas: [],
  misReservas: [],
  isLoading: false,

  fetchZonas: async (comunidadId: string) => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/common-spaces/${comunidadId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error');
      
      const data = await response.json();
      const zonasFormateadas = data.map((item: any) => ({
        id: item.id.toString(),
        nombre: item.name,
        aforo: 10,
        requiereQR: item.requires_qr || false,
        horaInicio: '09:00',
        horaFin: '21:00'
      }));
      set({ zonas: zonasFormateadas, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  crearZona: async (comunidadId: string, zona) => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().token;
      const payload = {
        name: zona.nombre,
        requires_qr: zona.requiereQR
      };

      const response = await fetch(`${API_URL}/common-spaces/${comunidadId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error');
      
      const item = await response.json();
      const nuevaZona: ZonaComun = {
        id: item.id.toString(),
        nombre: item.name,
        aforo: zona.aforo || 10,
        requiereQR: item.requires_qr || false,
        horaInicio: zona.horaInicio || '09:00',
        horaFin: zona.horaFin || '21:00'
      };
      
      set((state) => ({ zonas: [...state.zonas, nuevaZona], isLoading: false }));
    } catch (error) {
      set({ isLoading: false });
    }
  },

  crearReserva: async (reserva) => {
    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 1200));
    const nuevaReserva: Reserva = { ...reserva, id: Math.random().toString(36).substring(2, 9) };
    
    set((state) => ({ 
      misReservas: [...state.misReservas, nuevaReserva],
      isLoading: false 
    }));
    
    return nuevaReserva.id;
  },

  obtenerReservaPorId: (id) => {
    return get().misReservas.find(r => r.id === id);
  }
}));