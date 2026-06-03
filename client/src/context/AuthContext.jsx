import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

async function fetchUserProfile() {
  try {
    const result = await api.get('/api/admins/me');
    return result.data || null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem('vhub_token');
      const savedUser = localStorage.getItem('vhub_user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        const profile = await fetchUserProfile();
        if (profile) {
          setUser(profile);
          localStorage.setItem('vhub_user', JSON.stringify(profile));
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = async (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('vhub_token', authToken);
    localStorage.setItem('vhub_user', JSON.stringify(userData));
    const profile = await fetchUserProfile();
    if (profile) {
      setUser(profile);
      localStorage.setItem('vhub_user', JSON.stringify(profile));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('vhub_token');
    localStorage.removeItem('vhub_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
