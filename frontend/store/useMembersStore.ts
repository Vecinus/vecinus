import { create } from 'zustand';
import { API_URL, globalJwtToken } from '../constants/api';

export interface Member {
  id: string;
  membershipId: string;
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
  reset: () => void;
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

  reset: () => set({ members: [], isLoading: false, error: null }),

  fetchMembers: async (communityId) => {
    set({ isLoading: true, error: null });
    try {
      const url = `${API_URL}/${communityId}/users`;
      
      console.log(`[GET] Obteniendo miembros de: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${globalJwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      const formattedMembers: Member[] = data.map((item: any) => {
        const roleId = typeof item.role === 'number' ? item.role : parseInt(item.role, 10) || 3;
        
        return {
          id: item.id,
          membershipId: item.membership_id,
          name: item.username || 'Usuario sin nombre',
          roleId: roleId,
          roleName: ROLE_NAMES[roleId] || 'Desconocido',
        };
      });

      formattedMembers.sort((a, b) => a.roleId - b.roleId);

      set({ members: formattedMembers, isLoading: false });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error en fetchMembers:", error.message);
        set({ isLoading: false, error: error.message });
      } else {
        set({ isLoading: false, error: 'Ocurrió un error desconocido' });
      }
    }
  },

  deleteMember: async (membershipId) => {
    if (!membershipId) {
      console.error("Error crítico: membershipId es undefined o nulo.");
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      const url = `${API_URL}/members/${membershipId}`;
      
      console.log(`[DELETE] Intentando borrar miembro en: ${url}`);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${globalJwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`[DELETE] Código de respuesta: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[DELETE] Detalle del error del servidor:", errorData);
        throw new Error(errorData.detail || 'Error al eliminar al miembro. Verifica tus permisos.');
      }

      console.log("[DELETE] Borrado exitoso en BD. Actualizando interfaz...");
      set((state) => ({
        members: state.members.filter((m) => m.membershipId !== membershipId),
        isLoading: false
      }));

      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error atrapado en deleteMember:", error.message);
        set({ isLoading: false, error: error.message });
      } else {
        set({ isLoading: false, error: 'Ocurrió un error desconocido' });
      }
      return false;
    }
  },

  fetchMemberById: async (membershipId) => { return null; },
  inviteTenant: async (email, associationId, propertyId) => { return true; }
}));