import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';
import { useAuth } from '@/context/AuthContext';
import { LoginCredentials, User } from '@/types/auth.types';

export interface RegisterCredentials {
  email: string;
  password: string;
  password_confirm: string;
  username: string;
}

export const fetchUserWithCommunities = async (jwtToken: string): Promise<User> => {
  const [userResponse, communitiesResponse] = await Promise.all([
    apiClient.get<any>('/users/me', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }),
    apiClient.get<any[]>('/users/me/communities', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }),
  ]);

  const profile = userResponse.data;
  const communitiesData = communitiesResponse.data;

  return {
    id: profile.id,
    name: profile.username,
    email: profile.email,
    CommunitiesAndRole: communitiesData.map((membership: any) => ({
      community: {
        id: membership.neighborhood_associations.id,
        name: membership.neighborhood_associations.name,
        address: membership.neighborhood_associations.address ?? null,
      },
      role: membership.role,
    })),
  };
};


export const useAcceptInvitationMutation = () => {
  const { loginContext } = useAuth();

  return useMutation({
    mutationFn: async ({ invitation_token, password }: { invitation_token: string; password: string }) => {
      const response = await apiClient.post<any>('/auth/accept-invitation', {
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
      // 1. Login to get session
      const loginResponse = await apiClient.post<any>('/login', credentials);
      const { session } = loginResponse.data;
      const token = session.access_token;

      // 2. Fetch user profile
      const userResponse = await apiClient.get<any>('/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = userResponse.data;

      // 3. Fetch user communities
      const communitiesResponse = await apiClient.get<any[]>('/users/me/communities', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const communitiesData = communitiesResponse.data;

      // 4. Transform data to our User type
      const fullUser: User = {
        id: profile.id,
        name: profile.username,
        email: profile.email,
        CommunitiesAndRole: communitiesData.map((membership) => ({
          community: {
            id: membership.neighborhood_associations.id,
            name: membership.neighborhood_associations.name,
            address: membership.neighborhood_associations.address ?? null,
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