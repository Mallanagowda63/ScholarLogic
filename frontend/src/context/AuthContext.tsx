import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, StudentProfile } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  studentProfile: StudentProfile | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUserData = async () => {
    const token = localStorage.getItem('scholarlogic_token');
    if (!token) {
      setUser(null);
      setStudentProfile(null);
      setLoading(false);
      return;
    }

    try {
      const res: any = await api.get('/auth/me');
      if (res.success && res.data) {
        setUser(res.data.user);
        setStudentProfile(res.data.studentProfile || null);
      }
    } catch (err) {
      console.error('Session restore failed:', err);
      localStorage.removeItem('scholarlogic_token');
      setUser(null);
      setStudentProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUserData();
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('scholarlogic_token', token);
    setUser(userData);
    refreshUserData();
  };

  const logout = () => {
    localStorage.removeItem('scholarlogic_token');
    setUser(null);
    setStudentProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        studentProfile,
        loading,
        login,
        logout,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
