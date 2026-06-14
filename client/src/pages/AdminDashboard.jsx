import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUsers = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/admin/users`);
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        const data = await response.json();
        // 確保 data 是陣列，防止伺服器回傳錯誤物件導致 map crash
        setUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("無法獲取用戶名單", error);
        setUsers([]); // 發生錯誤時清空名單避免崩潰
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (usernameInput === 'k67' && passwordInput === '6767') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('帳號或密碼錯誤！');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-white">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all z-20"
        >
          🔙 回大廳
        </button>
        
        <div className="relative z-10 glass-panel p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full mx-4">
          <h1 className="text-3xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            後台身分驗證
          </h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div>
              <label className="block text-gray-400 mb-2 font-bold">帳號</label>
              <input 
                type="text" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="請輸入管理員帳號"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2 font-bold">密碼</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="請輸入密碼"
              />
            </div>
            {authError && <p className="text-red-400 text-sm font-bold">{authError}</p>}
            <button 
              type="submit" 
              className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-cyan-500/30"
            >
              登入後台
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 relative overflow-hidden text-white">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      <button 
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all z-20"
      >
        🔙 回大廳
      </button>

      <div className="max-w-4xl mx-auto mt-12 relative z-10 glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl">
        <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          後台管理中心
        </h1>
        <p className="text-gray-400 mb-8">目前系統中所有登入過的 Google 用戶名單</p>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/50 border-b border-white/10 text-sm tracking-wider uppercase text-gray-400">
                  <th className="p-4 font-bold">用戶</th>
                  <th className="p-4 font-bold hidden md:table-cell">Email</th>
                  <th className="p-4 font-bold text-right">最後登入時間</th>
                </tr>
              </thead>
              <tbody className="bg-black/20">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-gray-500">
                      目前沒有任何用戶登入紀錄。
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.googleId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {u.picture ? (
                            <img src={u.picture} alt="Avatar" className="w-10 h-10 rounded-full border border-white/20" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold">
                              {u.name ? u.name.charAt(0) : '?'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold">{u.name || 'Unknown User'}</div>
                            <div className="text-xs text-gray-500 md:hidden">{u.email || 'No Email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300 hidden md:table-cell">{u.email || 'No Email'}</td>
                      <td className="p-4 text-right text-gray-400 text-sm">
                        {new Date(u.lastLoginAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
