import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { apiClient, getStoredAuthToken, persistAuthToken } from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

interface AuthResponse {
  user?: User;
  message?: string;
  token?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await apiClient.get<AuthResponse>('/check-auth');
        if (data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        persistAuthToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const { data } = await apiClient.post<AuthResponse>('/login', {
        username,
        password
      });

      if (data.user && data.token) {
        persistAuthToken(data.token);
        setUser(data.user);
        router.push('/dashboard');
      } else {
        throw new Error(data.message || 'Authentication token missing from response');
      }
    } catch (error: any) {
      console.error('Login error details:', error.response?.data || error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      persistAuthToken(null);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 
