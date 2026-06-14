import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/admin/users`);
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error("無法獲取用戶名單", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

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
