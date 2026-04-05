import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { storageService } from '@/api/services/storage.service';
import { apiClient } from '@/api/client';
import { User } from '@/types/auth.types';

type ActiveCommunity = { id: string; name: string; role: string | number; address?: string | null };

const fetchUserWithCommunities = async (jwtToken: string): Promise<User> => {
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
    CommunitiesAndRole: communitiesData.map((membership) => ({
      community: {
        id: membership.neighborhood_associations.id,
        name: membership.neighborhood_associations.name,
        address: membership.neighborhood_associations.address ?? null,
      },
      role: membership.role,
    })),
  };
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeCommunity: ActiveCommunity | null;
  currentRole: string | number | null;
  loginContext: (user: User, token: string) => Promise<void>;
  logoutContext: () => Promise<void>;
  setActiveCommunity: (community: ActiveCommunity) => Promise<void>;
  refreshUserContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCommunity, setActiveCommunityState] = useState<ActiveCommunity | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [storedToken, storedUser, storedCommunity] = await Promise.all([
          storageService.getToken(),
          storageService.getUser(),
          storageService.getActiveCommunity(),
        ]);

        if (storedToken && storedUser) {
          let normalizedUser = storedUser;
          const needsCommunityAddressRefresh = storedUser.CommunitiesAndRole.some(
            (membership) => typeof membership.community.address === 'undefined'
          );

          if (needsCommunityAddressRefresh) {
            try {
              normalizedUser = await fetchUserWithCommunities(storedToken);
              await storageService.saveUser(normalizedUser);
            } catch (refreshError) {
              console.warn('Unable to refresh community addresses during hydration', refreshError);
            }
          }

          setToken(storedToken);
          setUser(normalizedUser);

          if (storedCommunity) {
            const storedMembership = normalizedUser.CommunitiesAndRole.find(
              c => c.community.id === storedCommunity.id
            );

            if (storedMembership) {
              const normalizedCommunity: ActiveCommunity = {
                id: storedMembership.community.id,
                name: storedMembership.community.name,
                role: storedMembership.role,
                address: storedCommunity.address ?? storedMembership.community.address ?? null,
              };
              setActiveCommunityState(normalizedCommunity);
              await storageService.saveActiveCommunity(normalizedCommunity);
            } else {
              selectFirstCommunity(normalizedUser);
            }
          } else if (normalizedUser.CommunitiesAndRole.length > 0) {
            selectFirstCommunity(normalizedUser);
          }
        }
      } catch (e) {
        console.error('Error hydrating auth', e);
      } finally {
        setIsLoading(false);
      }
    };

    hydrate();
  }, []);

  const selectFirstCommunity = async (userData: User) => {
    if (userData.CommunitiesAndRole.length > 0) {
      const firstCommunity = {
        id: userData.CommunitiesAndRole[0].community.id,
        name: userData.CommunitiesAndRole[0].community.name,
        role: userData.CommunitiesAndRole[0].role,
        address: userData.CommunitiesAndRole[0].community.address ?? null,
      };
      setActiveCommunityState(firstCommunity);
      await storageService.saveActiveCommunity(firstCommunity);
    }
  };

  const currentRole = useMemo<string | number | null>(() => {
    if (!user || !activeCommunity) return null;

    const membership = user.CommunitiesAndRole.find(
      c => c.community.id === activeCommunity.id
    );

    return membership?.role || null;
  }, [user, activeCommunity]);

  const loginContext = async (userData: User, jwtToken: string) => {
    setUser(userData);
    setToken(jwtToken);

    await storageService.saveToken(jwtToken);
    await storageService.saveUser(userData);


    await selectFirstCommunity(userData);
  };

  const setActiveCommunity = async (community: ActiveCommunity) => {
    setActiveCommunityState(community);
    await storageService.saveActiveCommunity(community);
  };

  const refreshUserContext = async () => {
    if (!token) return;

    try {
      const refreshedUser = await fetchUserWithCommunities(token);
      setUser(refreshedUser);
      await storageService.saveUser(refreshedUser);

      if (activeCommunity) {
        const updatedMembership = refreshedUser.CommunitiesAndRole.find(
          (c) => c.community.id === activeCommunity.id
        );

        if (updatedMembership) {
          const updatedCommunity: ActiveCommunity = {
            id: updatedMembership.community.id,
            name: updatedMembership.community.name,
            role: updatedMembership.role,
            address: updatedMembership.community.address ?? null,
          };
          setActiveCommunityState(updatedCommunity);
          await storageService.saveActiveCommunity(updatedCommunity);
          return;
        }
      }

      if (refreshedUser.CommunitiesAndRole.length > 0) {
        await selectFirstCommunity(refreshedUser);
      } else {
        setActiveCommunityState(null);
        await storageService.removeActiveCommunity();
      }
    } catch (e) {
      console.error('Error refreshing user context', e);
    }
  };

  const logoutContext = async () => {
    setUser(null);
    setToken(null);
    setActiveCommunityState(null);
    await storageService.clearAll();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        activeCommunity,
        currentRole,
        loginContext,
        logoutContext,
        setActiveCommunity,
        refreshUserContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};