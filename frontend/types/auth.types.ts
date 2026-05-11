export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  CommunitiesAndRole: {
    community: { id: string; name: string; address?: string | null };
    role: string | number;
  }[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthContextProps {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}
