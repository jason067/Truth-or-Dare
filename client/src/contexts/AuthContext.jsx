import React, { createContext, useState, useEffect, useContext } from 'react';
import { googleLogout } from '@react-oauth/google';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // 初始化時檢查 localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('party_hub_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("解析存儲的用戶資料失敗", err);
        localStorage.removeItem('party_hub_user');
      }
    }
  }, []);

  const loginUser = (userData) => {
    setUser(userData);
    localStorage.setItem('party_hub_user', JSON.stringify(userData));
  };

  const logoutUser = () => {
    googleLogout();
    setUser(null);
    localStorage.removeItem('party_hub_user');
  };

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
