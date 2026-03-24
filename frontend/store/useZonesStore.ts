import { create } from 'zustand';
import { API_URL } from '../constants/api';
import { useAuthStore } from './useAuthStore';

export interface ZonaComun {
  id: string | number;
  association_id?: string;
  name: string;
  requires_qr?: boolean;
  photo_url?: string;
  capacity?: number;
  start_time?: string;
  end_time?: string;
}

export interface Reserva {
  id: string | number;
  space_id: number | string;
  start_at: string;
  end_at: string;
  guests_count: string;
}

export interface PaseInvitado {
  id?: number;
  user_id?: string;
  space_id: number;
  space_name?: string;
  association_id?: string;
  requires_qr?: boolean;
  valid_for_date: string;
  qr_token?: string;
  status_id?: number;
  checked_in_at?: string;
  created_at?: string;
}

export interface OccupiedSlot {
  start_at: string;
  end_at: string;
}

interface ZonasState {
  zonas: ZonaComun[];
  misReservas: Reserva[];
  misPasesInvitado: PaseInvitado[];
  isLoading: boolean;
  error: string | null;

  fetchZonas: (comunidadId: string) => Promise<void>;
  obtenerZonaPorId: (comunidadId: string, zonaId: string | number) => Promise<ZonaComun | null>;
  crearZona: (comunidadId: string, zona: Partial<ZonaComun>) => Promise<void>;
  actualizarZona: (comunidadId: string, zonaId: string | number, payload: Partial<ZonaComun>) => Promise<void>;
  eliminarZona: (comunidadId: string, zonaId: string | number) => Promise<void>;
  subirFotoZona: (file: File | any) => Promise<any>;
  
  crearReserva: (reserva: Partial<Reserva>) => Promise<Reserva | null>;
  // AQUÍ ESTÁ LA CORRECCIÓN DE TYPESCRIPT:
  validarAccesoQR: (qrData: string) => Promise<{ valid: boolean; data?: any; message?: string }>;
  crearPaseInvitado: (pase: Partial<PaseInvitado>) => Promise<PaseInvitado | null>;

  obtenerHorariosOcupados: (spaceId: number | string, reservationDate: string) => Promise<OccupiedSlot[]>;
  obtenerMisReservas: (associationId: string) => Promise<void>;
  cancelarReserva: (reservationId: string | number) => Promise<void>;
  obtenerMisPasesInvitado: (associationId: string) => Promise<void>;
  cancelarPaseInvitado: (guestPassId: string | number) => Promise<void>;
}

export const useZonasStore = create<ZonasState>((set, get) => ({
  zonas: [],
  misReservas: [],
  misPasesInvitado: [],
  isLoading: false,
  error: null,

  fetchZonas: async (comunidadId: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/common-spaces/${comunidadId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al obtener zonas comunes');
      
      const data = await response.json();
      set({ zonas: Array.isArray(data) ? data : [], isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
    }
  },

  obtenerZonaPorId: async (comunidadId: string, zonaId: string | number) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/common-spaces/${comunidadId}/${zonaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al obtener la zona común');
      
      const data = await response.json();
      set({ isLoading: false });
      return data;
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return null;
    }
  },

  crearZona: async (comunidadId: string, zona) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/common-spaces/${comunidadId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(zona)
      });

      if (!response.ok) throw new Error('Error al crear la zona');
      
      const nuevaZona = await response.json();
      set((state) => ({ zonas: [...state.zonas, nuevaZona], isLoading: false }));
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
    }
  },

  actualizarZona: async (comunidadId: string, zonaId: string | number, payload) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/common-spaces/${comunidadId}/${zonaId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error al actualizar la zona');
      
      const zonaActualizada = await response.json();
      set((state) => ({
        zonas: state.zonas.map(z => z.id === zonaId ? zonaActualizada : z),
        isLoading: false
      }));
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
    }
  },

  eliminarZona: async (comunidadId: string, zonaId: string | number) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/common-spaces/${comunidadId}/${zonaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al eliminar la zona');
      
      set((state) => ({
        zonas: state.zonas.filter(z => z.id !== zonaId),
        isLoading: false
      }));
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
    }
  },

  subirFotoZona: async (file) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/common-spaces/upload-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Error al subir la foto');
      const data = await response.json();
      set({ isLoading: false });
      return data;
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return null;
    }
  },

  crearReserva: async (reserva) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/reservations/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reserva)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al crear la reserva');
      }
      
      const nuevaReserva = await response.json();
      set((state) => ({ 
        misReservas: [...state.misReservas, nuevaReserva],
        isLoading: false 
      }));
      return nuevaReserva;
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  validarAccesoQR: async (qrData: string) => {
    try {
      const token = useAuthStore.getState().token;
      let payload = {};
      try {
        payload = JSON.parse(qrData);
      } catch (e) {
        payload = { qr_code: qrData };
      }
      
      const response = await fetch(`${API_URL}/reservations/validate-qr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { valid: true, data: data };
      } 
      
      const errorData = await response.json().catch(() => ({}));
      return { valid: false, message: errorData.detail || 'Código denegado por el servidor.' };

    } catch (error) {
      return { valid: false, message: 'No se pudo conectar con el servidor.' };
    }
  },

  crearPaseInvitado: async (pase) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/guest-passes/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pase)
      });

      if (!response.ok) throw new Error('Error al crear el pase de invitado');
      
      const nuevoPase = await response.json();
      set((state) => ({ 
        misPasesInvitado: [...state.misPasesInvitado, nuevoPase],
        isLoading: false 
      }));
      return nuevoPase;
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return null;
    }
  },

  obtenerHorariosOcupados: async (spaceId: number | string, reservationDate: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/reservations/occupied-slots?space_id=${spaceId}&reservation_date=${reservationDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al obtener horarios ocupados');
      
      const data = await response.json();
      set({ isLoading: false });
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return [];
    }
  },

  obtenerMisReservas: async (associationId: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/reservations/me?association_id=${associationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al obtener mis reservas');
      
      const data = await response.json();
      set({ misReservas: Array.isArray(data) ? data : [], isLoading: false });
    } catch (error: any) {
      set({ misReservas: [], isLoading: false, error: error.message });
    }
  },

  cancelarReserva: async (reservationId: string | number) => {
    set({ isLoading: true, error: null });
    
    if (!reservationId) {
      throw new Error("ID de reserva inválido");
    }

    try {
      const token = useAuthStore.getState().token;
      const url = `${API_URL}/reservations/${reservationId}/cancel`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({}) 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al cancelar la reserva');
      }
      
      set((state) => ({
        misReservas: state.misReservas.filter((r) => String(r.id) !== String(reservationId)),
        isLoading: false
      }));
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error; 
    }
  },

  obtenerMisPasesInvitado: async (associationId: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/guest-passes/me?association_id=${associationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al obtener mis pases de invitado');
      
      const data = await response.json();
      set({ misPasesInvitado: Array.isArray(data) ? data : [], isLoading: false });
    } catch (error: any) {
      set({ misPasesInvitado: [], isLoading: false, error: error.message });
    }
  },

  cancelarPaseInvitado: async (guestPassId: string | number) => {
    set({ isLoading: true, error: null });
    
    if (!guestPassId) {
      throw new Error("ID de pase de invitado inválido");
    }

    try {
      const token = useAuthStore.getState().token;
      const url = `${API_URL}/guest-passes/${guestPassId}/cancel`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({}) 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al cancelar el pase de invitado');
      }
      
      set((state) => ({
        misPasesInvitado: state.misPasesInvitado.filter((p) => String(p.id) !== String(guestPassId)),
        isLoading: false
      }));
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error; 
    }
  }

}));