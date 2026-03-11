import { create } from 'zustand';
import { API_URL, globalJwtToken } from '../constants/api';

export interface Member {
  id: string;
  membershipId: string;
  name: string;
  roleId: number;   
  roleName: string; 
}

export interface PendingInvitation {
  id: string;
  target_email: string;
  role_to_grant: number;
  created_at: string;
  property_id?: string;
}

interface MembersState {
  members: Member[];
  pendingInvitations: PendingInvitation[];
  isLoading: boolean;
  error: string | null;
  
  roles: () => Map<number, string>;
  fetchMembers: (communityId: string) => Promise<void>;
  fetchPendingInvitations: (communityId: string) => Promise<void>;
  fetchMemberById: (membershipId: string) => Promise<Member | null>;
  inviteByAdmin: (email: string, roleToGrant: string, associationId: string, propertyId: string) => Promise<boolean>;
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
  pendingInvitations: [],
  isLoading: false,
  error: null,

  fetchMembers: async (communityId) => {
    set({ isLoading: true, error: null });
    try {
      const url = `${API_URL}/${communityId}/users`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${globalJwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

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
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Error desconocido' });
    }
  },

  fetchPendingInvitations: async (communityId) => {
    try {
      const url = `${API_URL}/${communityId}/invitations/pending`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${globalJwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        set({ pendingInvitations: data });
      }
    } catch (error) {
      console.error("Error fetching pending invitations:", error);
    }
  },

  deleteMember: async (membershipId) => {
    if (!membershipId) return false;
    set({ isLoading: true, error: null });
    try {
      const url = `${API_URL}/members/${membershipId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${globalJwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al eliminar al miembro.');
      }

      set((state) => ({
        members: state.members.filter((m) => m.membershipId !== membershipId),
        isLoading: false
      }));
      return true;
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return false;
    }
  },

  fetchMemberById: async (membershipId) => { return null; },
  
  inviteByAdmin: async (email, roleToGrant, associationId, propertyId) => { 
    try {
      const url = `${API_URL}/invite/admin`;
      const bodyToSend: any = {
          target_email: email,
          role_to_grant: parseInt(roleToGrant,10),
          association_id: associationId,
      };

      if (propertyId && propertyId !== "") bodyToSend.property_id = propertyId;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${globalJwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyToSend)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al enviar invitación.');
      }
      return true
    } catch (error: any) {
        set({ isLoading: false, error: error.message });
        return false;
    }
  },
  
  roles: () => {
    return new Map<number, string>([
      [2, 'Propietario'],
      [3, 'Inquilino'],
      [4, 'Presidente'],
      [5, 'Empleado']
    ]);
  }
}));