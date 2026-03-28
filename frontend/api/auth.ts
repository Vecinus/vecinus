import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client'; 
import { useAuth } from '@/context/AuthContext';
import { LoginCredentials, User } from '@/types/auth.types';

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