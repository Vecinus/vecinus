import { apiClient } from './client';
import { User } from '@/types/auth.types';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
}

export interface MembershipItem {
  role: string | number;
  neighborhood_associations: {
    id: string;
    name: string;
    address?: string | null;
  };
}

export const fetchUserWithCommunities = async (jwtToken: string): Promise<User> => {
  const [userResponse, communitiesResponse] = await Promise.all([
    apiClient.get<UserProfile>('/users/me', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }),
    apiClient.get<MembershipItem[]>('/users/me/communities', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }),
  ]);

  const profile = userResponse.data;
  const communitiesData = communitiesResponse.data;

  return {
    id: profile.id,
    name: profile.username,
    email: profile.email,
    avatarUrl: profile.avatar_url ?? null,
    CommunitiesAndRole: communitiesData.map((membership: MembershipItem) => ({
      community: {
        id: membership.neighborhood_associations.id,
        name: membership.neighborhood_associations.name,
        address: membership.neighborhood_associations.address ?? null,
      },
      role: membership.role,
    })),
  };
};
