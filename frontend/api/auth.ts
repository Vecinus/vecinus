import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client'; 
import { useAuth } from '@/context/AuthContext';
import { LoginCredentials, AuthResponse } from '@/types/auth.types';

export const useLoginMutation = () => {
  const { loginContext } = useAuth();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiClient.post<any>('/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      const token = data.session.access_token;
      const user = data.user;
      loginContext(user, token);
    },
  });
};