import { create } from 'zustand';
import { API_URL } from '../constants/api';

// ==========================================
// 📝 DEFINICIÓN DE TIPOS
// ==========================================

export interface Member {
  id: string;
  name: string;
  roleId: number;   
  roleName: string; 
}

interface MembersState {
  members: Member[];
  isLoading: boolean;
  error: string | null;
  
  fetchMembers: (communityId: string) => Promise<void>;
  fetchMemberById: (membershipId: string) => Promise<Member | null>;
  inviteTenant: (email: string, associationId: string, propertyId: string) => Promise<boolean>;
  deleteMember: (membershipId: string) => Promise<boolean>;
}

const ROLE_NAMES: Record<number, string> = {
  1: 'Administrador',
  2: 'Propietario',
  3: 'Inquilino',
  4: 'Presidente',
  5: 'Empleado'
};

export const useMembersStore = create<MembersState>((set, get) => ({
  members: [],
  isLoading: false,
  error: null,

  fetchMembers: async (communityId) => {
    set({ isLoading: true, error: null });
    try {
      const token = process.env.EXPO_PUBLIC_TEST_JWT;
      
      const response = await fetch(`${API_URL}/${communityId}/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al obtener los miembros');

      const data = await response.json();

      const formattedMembers: Member[] = data.map((item: any) => {
        const roleId = typeof item.role === 'number' ? item.role : parseInt(item.role, 10) || 3;
        
        return {
          id: item.id,
          name: item.username || 'Usuario sin nombre',
          roleId: roleId,
          roleName: ROLE_NAMES[roleId] || 'Desconocido',
        };
      });

      formattedMembers.sort((a, b) => a.roleId - b.roleId);

      set({ members: formattedMembers, isLoading: false });
    } catch (error: any) {
      console.error("Error en fetchMembers:", error.message);
      set({ isLoading: false, error: error.message });
    }
  },

  fetchMemberById: async (membershipId) => { /* ... */ return null; },
  inviteTenant: async (email, associationId, propertyId) => { /* ... */ return true; },
  deleteMember: async (membershipId) => { /* ... */ return true; }
}));