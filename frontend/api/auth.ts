import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';
import { useAuth } from '@/context/AuthContext';
import { LoginCredentials, User } from '@/types/auth.types';
import { fetchUserWithCommunities, MembershipItem } from './user';

export interface RegisterCredentials {
  email: string;
  password: string;
  password_confirm: string;
  username: string;
  avatar_url?: string | null;
}

export interface RemoveAccountCredentials {
  email: string;
  password: string;
}

export interface RecoverAccountCredentials {
  account_id: string;
  password: string;
}

export interface RecoverAccountProfilePayload {
  id: string;
  password: string;
  username: string;
  email: string;
  avatar_url?: string | null;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
}

export { fetchUserWithCommunities };

export const useAcceptInvitationMutation = () => {
  const { loginContext } = useAuth();

  return useMutation({
    mutationFn: async ({ invitation_token, password }: { invitation_token: string; password: string }) => {
      const response = await apiClient.post<{ token: string }>('/auth/accept-invitation', {
        invitation_token,
        password,
      });

      const token = response.data.token;

      if (!token) {
        throw new Error("No se recibió un token de acceso tras aceptar la invitación.");
      }

      const fullUser = await fetchUserWithCommunities(token);

      return { user: fullUser, token };
    },
    onSuccess: (data) => {
      loginContext(data.user, data.token);
    },
  });
};

export const useLoginMutation = () => {
  const { loginContext } = useAuth();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const loginResponse = await apiClient.post<{ session: { access_token: string } }>('/login', credentials);
      const { session } = loginResponse.data;
      const token = session.access_token;

      const [userResponse, communitiesResponse] = await Promise.all([
        apiClient.get<UserProfile>('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiClient.get<MembershipItem[]>('/users/me/communities', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const profile = userResponse.data;
      const communitiesData = communitiesResponse.data;

      const fullUser: User = {
        id: profile.id,
        name: profile.username,
        email: profile.email,
        avatarUrl: profile.avatar_url ?? null,
        CommunitiesAndRole: communitiesData.map((membership) => ({
          community: {
            id: membership.neighborhood_associations.id,
            name: membership.neighborhood_associations.name,
            address: membership.neighborhood_associations.address ?? null,
            household_count: membership.neighborhood_associations.household_count ?? null,
          },
          role: membership.role,
        })),
      };

      return { user: fullUser, token };
    },
    onSuccess: (data) => {
      loginContext(data.user, data.token);
    },
  });
};

export const useRegisterMutation = () => {
  return useMutation({
    mutationFn: async (credentials: RegisterCredentials) => {
      const response = await apiClient.post<unknown>('/register', credentials);
      return response.data;
    },
  });
};

export const removeAccount = async (credentials: RemoveAccountCredentials): Promise<{ id: string }> => {
  const response = await apiClient.post<{ id: string }>('/remove', credentials);
  return response.data;
};

export const recoverDeletedAccount = async (
  credentials: RecoverAccountCredentials
): Promise<{ id: string; message: string }> => {
  const response = await apiClient.post<{ id: string; message: string }>('/recover', null, {
    params: credentials,
  });
  return response.data;
};

export const unanonymizeRecoveredAccount = async (
  payload: RecoverAccountProfilePayload
): Promise<{ id: string; message: string }> => {
  const response = await apiClient.post<{ id: string; message: string }>('/recover/unanonymize', payload);
  return response.data;
};

export const useRemoveAccountMutation = () => {
  return useMutation({
    mutationFn: removeAccount,
  });
};
export const updateMyAvatarUrl = async (token: string, avatarUrl?: string | null) => {
  const response = await apiClient.put(
    '/users/me/avatar',
    { avatar_url: avatarUrl?.trim() || null },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
};
