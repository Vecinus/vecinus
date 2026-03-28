import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';
import { storageService } from '@/api/services/storage.service';
import { User } from '@/types/auth.types';

type ActiveCommunity = { id: string; name: string, role: string };

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeCommunity: ActiveCommunity | null; 
  currentRole: string | null; 
  loginContext: (user: User, token: string) => Promise<void>;
  logoutContext: () => Promise<void>;
  setActiveCommunity: (community: ActiveCommunity) => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCommunity, setActiveCommunityState] = useState<ActiveCommunity | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [storedToken, storedUser, storedCommunity] = await Promise.all([
          storageService.getToken(),
          storageService.getUser(),
          storageService.getActiveCommunity(),
        ]);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);

          if (storedCommunity) {
            const isMember = storedUser.CommunitiesAndRole.some(
              c => c.community.id === storedCommunity.id
            );
            
            if (isMember) {
              setActiveCommunityState(storedCommunity);
            } else {
              selectFirstCommunity(storedUser);
            }
          } else if (storedUser.CommunitiesAndRole.length > 0) {
            selectFirstCommunity(storedUser);
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
      };
      setActiveCommunityState(firstCommunity);
      await storageService.saveActiveCommunity(firstCommunity);
    }
  };

  const currentRole = useMemo(() => {
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

  const logoutContext = async () => {
    setUser(null);
    setToken(null);
    setActiveCommunityState(null);
    await storageService.clearAll(); 
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