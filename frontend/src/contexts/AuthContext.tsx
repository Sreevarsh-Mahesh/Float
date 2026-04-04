import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import apiClient from "../api/client";

interface User {
  id: number;
  email: string;
  phone: string;
  full_name: string | null;
  platform: string;
  h3_home_cell: string | null;
  is_active: boolean;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (access: string, refresh: string) => void;
  logout: () => void;
  isLoading: boolean;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("accessToken"));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUser = async () => {
    try {
      if (!token) return;
      const res = await apiClient.get<User>("/users/me");
      setUser(res.data);
    } catch (err) {
      console.error("Failed to fetch user", err);
      // Could handle specific errors here
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [token]);

  const login = (access: string, refresh: string) => {
    localStorage.setItem("accessToken", access);
    localStorage.setItem("refreshToken", refresh);
    setToken(access);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
