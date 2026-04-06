import { apiClient } from './client';
import { ROLE_LABELS } from '@/utils/role.util';

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

export interface Property {
  id: string;
  number: string;
}

export interface UserInvitation {
  id: string;
  communityName: string;
  roleName: string;
  roleId: number;
  date: string;
}

export const communityApi = {
  getMembers: async (communityId: string): Promise<Member[]> => {
    // El frontend antiguo llamaba a: `${API_URL}/${communityId}/users`
    const { data } = await apiClient.get(`/${communityId}/users`);
    
    // Mapeo defensivo para evitar fallos si el backend devuelve ids raros
    const formattedMembers: Member[] = data.map((item: any) => {
      const roleId = typeof item.role === 'number' ? item.role : parseInt(item.role, 10) || 3;
      return {
        id: item.id,
        membershipId: item.membership_id,
        name: item.username || 'Usuario sin nombre',
        roleId,
        roleName: ROLE_LABELS[roleId] || 'Desconocido',
      };
    });

    return formattedMembers.sort((a, b) => a.roleId - b.roleId);
  },

  getPendingInvitations: async (communityId: string): Promise<PendingInvitation[]> => {
    // El frontend antiguo llamaba a: `${API_URL}/${communityId}/invitations/pending`
    const { data } = await apiClient.get(`/${communityId}/invitations/pending`);
    return data;
  },

  deleteMember: async (membershipId: string): Promise<void> => {
    // El frontend antiguo llamaba a: `${API_URL}/members/${membershipId}`
    await apiClient.delete(`/members/${membershipId}`);
  },

  inviteMember: async ({
    email,
    roleToGrant,
    communityId,
    propertyId,
  }: {
    email: string;
    roleToGrant: number;
    communityId: string;
    propertyId?: string;
  }): Promise<void> => {
    // El frontend antiguo llamaba a: `${API_URL}/invite/admin`
    const body: Record<string, any> = {
      target_email: email,
      role_to_grant: roleToGrant,
      association_id: communityId,
    };
    if (propertyId) {
      body.property_id = propertyId;
    }

    await apiClient.post(`/invite/admin`, body);
  },

  getAvailableProperties: async (communityId: string): Promise<Property[]> => {
    // El frontend antiguo llamaba a: `${API_URL}/${communityId}/properties/available`
    const safeCommunityId = encodeURIComponent(communityId);
    const { data } = await apiClient.get(`/${safeCommunityId}/properties/available`);
    return Array.isArray(data) ? data : [];
  },

  addProperty: async (communityId: string, number: string): Promise<void> => {
    // El frontend antiguo llamaba a: `${API_URL}/${communityId}/properties`
    const safeCommunityId = encodeURIComponent(communityId);
    await apiClient.post(`/${safeCommunityId}/properties`, { number });
  },

  getMyInvitations: async (): Promise<UserInvitation[]> => {
    const { data } = await apiClient.get('/users/me/invitations');
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const rawRoleId = item.roleId ?? item.role_id ?? item.role_to_grant;
      const roleId = Number(rawRoleId) || 0;
      const communityName =
        item.communityName ??
        item.community_name ??
        item.neighborhood_associations?.name ??
        'Comunidad Desconocida';
      const roleName =
        item.roleName ??
        item.role_name ??
        ROLE_LABELS[roleId] ??
        'Miembro';
      const date = item.date ?? item.created_at ?? new Date().toISOString();

      return {
        id: String(item.id),
        communityName,
        roleId,
        roleName,
        date,
      };
    });
  },

  acceptInvitation: async (invitationId: string): Promise<void> => {
    await apiClient.post(`/invitations/${invitationId}/accept`);
  },

  rejectInvitation: async (invitationId: string): Promise<void> => {
    await apiClient.post(`/invitations/${invitationId}/reject`);
  },

  getRolesOptions: () => {
    return [
      { id: 2, label: ROLE_LABELS[2] },
      { id: 3, label: ROLE_LABELS[3] },
      { id: 4, label: ROLE_LABELS[4] },
      { id: 5, label: ROLE_LABELS[5] },
    ];
  },

  getRoleName: (roleId: number) => {
    return ROLE_LABELS[roleId] || 'Desconocido';
  }
};
