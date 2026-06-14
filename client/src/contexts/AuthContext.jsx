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
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
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

  const loginGuest = async (name) => {
    try {
      let guestId = localStorage.getItem('partyhub_guest_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('partyhub_guest_id', guestId);
      }
      
      const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
      const res = await fetch(`${BACKEND_URL}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, guestId })
      });
      const data = await res.json();
      if (data.success) {
        loginUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  const logoutUser = () => {
    googleLogout();
    setUser(null);
    localStorage.removeItem('party_hub_user');
    // 可選：不要清除 guest_id，這樣如果同個瀏覽器再選訪客還是同一個 ID
  };

  return (
    <AuthContext.Provider value={{ user, loginUser, loginGuest, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
