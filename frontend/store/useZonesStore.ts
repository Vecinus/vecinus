import { create } from 'zustand';

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
  fetchZonas: () => Promise<void>;
  crearZona: (zona: Omit<ZonaComun, 'id'>) => Promise<void>;
  crearReserva: (reserva: Omit<Reserva, 'id'>) => Promise<string>;
  obtenerReservaPorId: (id: string) => Reserva | undefined;
}

export const useZonasStore = create<ZonasState>((set, get) => ({
  zonas: [
    { id: '1', nombre: 'Pádel', aforo: 4, requiereQR: true, horaInicio: '09:00', horaFin: '21:00' },
    { id: '2', nombre: 'Piscina', aforo: 50, requiereQR: false, horaInicio: '10:00', horaFin: '21:00' }
  ],
  misReservas: [],
  isLoading: false,

  fetchZonas: async () => {
    set({ isLoading: true });
    // Simula GET /api/zonas
    await new Promise(resolve => setTimeout(resolve, 500));
    set({ isLoading: false });
  },

  crearZona: async (zona) => {
    set({ isLoading: true });
    // Simula POST /api/zonas
    await new Promise(resolve => setTimeout(resolve, 1000));
    const nuevaZona: ZonaComun = { ...zona, id: Math.random().toString(36).substr(2, 9) };
    
    set((state) => ({ 
      zonas: [...state.zonas, nuevaZona],
      isLoading: false 
    }));
  },

  crearReserva: async (reserva) => {
    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 1200));
    const nuevaReserva: Reserva = { ...reserva, id: Math.random().toString(36).substr(2, 9) };
    
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