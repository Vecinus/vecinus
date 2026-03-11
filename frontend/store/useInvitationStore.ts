import { create } from 'zustand';
import { API_URL } from '@/constants/api';
import { useAuthStore } from './useAuthStore';
import { useCommunityStore } from './useCommunityStore';

export interface Invitation {
  id: string;
  communityName: string;
  roleName: string;
  roleId: number;
  date: string;
}

interface InvitationsState {
  invitations: Invitation[];
  isLoading: boolean;
  error: string | null;
  fetchInvitations: () => Promise<void>;
  acceptInvitation: (id: string) => Promise<boolean>;
  rejectInvitation: (id: string) => Promise<boolean>;
}

export const useInvitationsStore = create<InvitationsState>((set) => ({
  invitations: [],
  isLoading: false,
  error: null,

  fetchInvitations: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/users/me/invitations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener las invitaciones');
      }

      const data = await response.json();
      set({ invitations: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  acceptInvitation: async (id: string) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_URL}/invitations/${id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al aceptar la invitación');
      }

      set((state) => ({
        invitations: state.invitations.filter((inv) => inv.id !== id),
      }));

      await useCommunityStore.getState().fetchCommunities();

      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },
  rejectInvitation: async (id: string) => {
    try {
      const token = useAuthStore.getState().token;
      console.log("Enviando rechazo para ID:", id); // DEBUG

      const response = await fetch(`${API_URL}/invitations/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      // 1. Primero verificamos si hay respuesta
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); 
        console.error("Error del servidor:", errorData);
        throw new Error(errorData.detail || 'Error al rechazar la invitación');
      }

      // 2. Si todo OK, actualizamos estado
      set((state) => ({
        invitations: state.invitations.filter((inv) => inv.id !== id),
        error: null
      }));

      return true;
    } catch (error: any) {
      console.error("Error en la petición reject:", error.message);
      set({ error: error.message });
      return false;
    }
  },
}));