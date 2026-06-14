import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [chats, setChats] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [banDays, setBanDays] = useState('1');
  const [banReason, setBanReason] = useState('違反社群規範');
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/users`);
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("無法獲取用戶名單", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/rooms`);
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("無法獲取房間列表", error);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchChats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/lobby/chat`);
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setChats(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("無法獲取聊天紀錄", error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/appeals`);
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setAppeals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("無法獲取申訴紀錄", error);
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'rooms') fetchRooms();
    if (activeTab === 'chats') fetchChats();
    if (activeTab === 'appeals') fetchAppeals();
  }, [isAuthenticated, activeTab]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (usernameInput === 'k67' && passwordInput === '6767') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('帳號或密碼錯誤！');
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMsg })
      });
      alert('廣播已發送！');
      setBroadcastMsg('');
    } catch (err) {
      alert('發送失敗！');
    }
  };

  const handleDeleteRoom = async (roomCode) => {
    if (!window.confirm(`確定要毀滅房間 ${roomCode} 嗎？所有玩家將被踢出！`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/rooms/${roomCode}`, { method: 'DELETE' });
      fetchRooms();
    } catch (err) {
      alert('毀滅房間失敗！');
    }
  };

  const handleKickPlayer = async (roomCode, playerId) => {
    if (!window.confirm('確定要踢出該玩家嗎？')) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/rooms/${roomCode}/players/${playerId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick' })
      });
      fetchRooms();
    } catch (err) {
      alert('踢人失敗！');
    }
  };

  const handleAddCoins = async (roomCode, playerId) => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/rooms/${roomCode}/players/${playerId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_coins', payload: { amount: 1000 } })
      });
      alert('已發送 1000 金幣！');
      fetchRooms();
    } catch (err) {
      alert('加錢失敗！');
    }
  };

  const handleUserAction = async (userId, action) => {
    if (action === 'ban') {
      setBanTarget(userId);
      setBanModalOpen(true);
      return;
    }
    try {
      await fetch(`${BACKEND_URL}/api/admin/users/${userId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      fetchUsers();
    } catch (err) {
      alert('操作失敗！');
    }
  };

  const submitBan = async () => {
    if (!banTarget) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/users/${banTarget}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban', banDays, reason: banReason })
      });
      setBanModalOpen(false);
      fetchUsers();
    } catch (err) {
      alert('封鎖失敗！');
    }
  };

  const handleAppealAction = async (appealId, action) => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/appeals/${appealId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      fetchAppeals();
      fetchUsers();
    } catch (err) {
      alert('操作失敗！');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('確定要刪除該用戶嗎？')) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err) {
      alert('刪除失敗！');
    }
  };

  const handleDeleteChat = async (chatId) => {
    if (!window.confirm('確定要刪除該聊天訊息嗎？')) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/chat/${chatId}`, { method: 'DELETE' });
      fetchChats();
    } catch (err) {
      alert('刪除失敗！');
    }
  };

  const [newUserName, setNewUserName] = useState('');
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName.trim() })
      });
      setNewUserName('');
      fetchUsers();
    } catch (err) {
      alert('新增失敗！');
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
    <div className="min-h-screen p-6 md:p-12 relative overflow-hidden text-white flex flex-col md:flex-row gap-6">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      <button 
        onClick={() => { setIsAuthenticated(false); setUsernameInput(''); setPasswordInput(''); }}
        className="absolute top-6 right-6 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl font-bold transition-all z-20 border border-red-500/30"
      >
        登出後台
      </button>

      {/* Sidebar */}
      <div className="w-full md:w-64 glass-panel p-6 rounded-3xl border border-white/10 flex flex-col gap-4 relative z-10">
        <h2 className="text-2xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">上帝之手</h2>
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${activeTab === 'users' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-white/5 hover:bg-white/10'}`}
        >
          👥 會員名單
        </button>
        <button 
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${activeTab === 'rooms' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-white/5 hover:bg-white/10'}`}
        >
          🎮 房間管理
        </button>
        <button 
          onClick={() => setActiveTab('appeals')}
          className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${activeTab === 'appeals' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-white/5 hover:bg-white/10'}`}
        >
          📄 申訴審核
        </button>
        <button 
          onClick={() => setActiveTab('chats')}
          className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${activeTab === 'chats' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-white/5 hover:bg-white/10'}`}
        >
          💬 聊天管理
        </button>
        <button 
          onClick={() => setActiveTab('broadcast')}
          className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${activeTab === 'broadcast' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 hover:bg-white/10'}`}
        >
          📢 全服廣播
        </button>
        <button 
          onClick={() => navigate('/')}
          className="mt-auto px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all text-center"
        >
          🔙 回大廳
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 glass-panel p-6 md:p-8 rounded-3xl border border-white/10 relative z-10 overflow-y-auto max-h-[85vh]">
        
        {loading && <div className="text-cyan-400 animate-pulse mb-4 font-bold">資料同步中...</div>}

        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">會員登入紀錄</h3>
              <button onClick={fetchUsers} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors ml-4 mr-auto">🔄 重新整理</button>
              <form onSubmit={handleAddUser} className="flex gap-2">
                <input 
                  type="text" 
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="輸入新用戶名稱" 
                  className="px-3 py-1 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                />
                <button type="submit" className="px-3 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 border border-green-500/30 rounded-lg text-sm font-bold transition-colors">
                  新增用戶
                </button>
              </form>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/50 border-b border-white/10 text-sm tracking-wider uppercase text-gray-400">
                    <th className="p-4 font-bold">用戶</th>
                    <th className="p-4 font-bold hidden md:table-cell">Email</th>
                    <th className="p-4 font-bold text-center">狀態</th>
                    <th className="p-4 font-bold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-black/20">
                  {users.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-gray-500">沒有紀錄</td></tr>
                  ) : users.map(u => (
                    <tr key={u._id || u.googleId || Math.random()} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {u.picture ? (
                            <img src={u.picture} alt="" className="w-10 h-10 rounded-full border border-white/20" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold">
                              {u.name ? u.name.charAt(0) : '?'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              {u.name || 'Unknown User'}
                              {u.isMuted && <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-md border border-yellow-500/30">禁言中</span>}
                              {u.isBanned && (
                                <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-md border border-red-500/30">
                                  {u.banUntil ? `封鎖至 ${new Date(u.banUntil).toLocaleDateString()}` : '永久封鎖'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 md:hidden">{u.email || 'No Email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300 hidden md:table-cell">{u.email || 'No Email'}</td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col gap-1 text-xs">
                          {u.isMuted ? (
                            <button onClick={() => handleUserAction(u._id, 'unmute')} className="px-2 py-1 bg-yellow-500/10 hover:bg-yellow-500/30 text-yellow-400 rounded border border-yellow-500/30">解除禁言</button>
                          ) : (
                            <button onClick={() => handleUserAction(u._id, 'mute')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-yellow-400 rounded border border-white/10">禁言</button>
                          )}
                          {u.isBanned ? (
                            <button onClick={() => handleUserAction(u._id, 'unban')} className="px-2 py-1 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded border border-red-500/30">解除封鎖</button>
                          ) : (
                            <button onClick={() => handleUserAction(u._id, 'ban')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-red-400 rounded border border-white/10">封鎖</button>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeleteUser(u._id)} className="px-3 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg border border-red-600/30 text-sm font-bold transition-colors">刪除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rooms' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">活躍房間列表</h3>
              <button onClick={fetchRooms} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors">🔄 重新整理</button>
            </div>
            
            {rooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500 bg-black/20 rounded-xl border border-white/5 font-bold">目前伺服器沒有任何房間。</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {rooms.map(room => (
                  <div key={room.roomCode} className="bg-black/40 border border-white/10 p-6 rounded-2xl relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-2xl font-black text-white tracking-widest">{room.roomCode}</div>
                        <div className="text-sm text-cyan-400 font-bold mt-1">遊戲類型：{room.gameType}</div>
                        <div className="text-xs text-gray-400 mt-1">當前狀態：{room.status}</div>
                      </div>
                      <button 
                        onClick={() => handleDeleteRoom(room.roomCode)}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg border border-red-500/30 transition-all text-sm font-bold shadow-lg"
                      >
                        💥 毀滅房間
                      </button>
                    </div>
                    
                    <div className="text-sm font-bold text-gray-300 mb-2 mt-4 flex items-center gap-2">
                      <span>玩家列表</span>
                      <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs">{room.players?.length || 0}</span>
                    </div>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {room.players && room.players.map(p => (
                        <div key={p._id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            {p.isHost && <span className="text-yellow-400" title="房主">👑</span>}
                            <span className="font-bold text-white">{p.nickname}</span>
                            <span className="text-xs px-2 py-1 bg-black/50 rounded-md text-gray-400">{p.status}</span>
                            <span className="text-xs text-yellow-300 ml-1 font-bold">🪙 {p.coins || 0}</span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleAddCoins(room.roomCode, p._id)}
                              className="px-2 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 rounded-lg border border-yellow-500/30 text-xs font-bold transition-colors"
                              title="給予 1000 金幣"
                            >
                              💰 +1000
                            </button>
                            <button 
                              onClick={() => handleKickPlayer(room.roomCode, p._id)}
                              className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg border border-red-500/30 text-xs font-bold transition-colors"
                            >
                              踢出
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chats' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">大廳聊天管理</h3>
              <button onClick={fetchChats} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors">🔄 重新整理</button>
            </div>
            <div className="space-y-4 max-w-4xl">
              {chats.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-black/20 rounded-xl border border-white/5 font-bold">沒有聊天紀錄</div>
              ) : chats.map(chat => (
                <div key={chat._id} className="bg-black/40 border border-white/10 p-4 rounded-xl flex justify-between items-center group hover:bg-white/5 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-cyan-400">{chat.user}</span>
                      <span className="text-xs text-gray-500">{new Date(chat.time).toLocaleString()}</span>
                      {chat.type === 'invite' && <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded text-xs border border-pink-500/30">邀請訊息</span>}
                    </div>
                    <div className="text-gray-200">{chat.message}</div>
                  </div>
                  <button 
                    onClick={() => handleDeleteChat(chat._id)}
                    className="ml-4 px-3 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg border border-red-600/30 text-sm font-bold transition-colors opacity-0 group-hover:opacity-100"
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="flex flex-col gap-4 max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📢</span>
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">全服系統廣播</h3>
            </div>
            <p className="text-gray-400 font-medium">
              發送的訊息將會以彈出視窗 (Alert) 的形式，直接顯示給所有目前正在各個遊戲房間內的玩家。
            </p>
            <textarea 
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="w-full h-32 bg-black/40 border border-purple-500/30 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 transition-colors resize-none shadow-inner text-lg"
              placeholder="請輸入要廣播的訊息內容 (例如：系統將於 10 分鐘後維護...)"
            />
            <button 
              onClick={handleBroadcast}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/30 transition-all transform hover:scale-[1.01] active:scale-95 text-lg flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>發送全服廣播</span>
            </button>
          </div>
        )}
        {activeTab === 'appeals' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">申訴審核列表</h3>
              <button onClick={fetchAppeals} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors">🔄 重新整理</button>
            </div>
            <div className="space-y-4 max-w-4xl">
              {appeals.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-black/20 rounded-xl border border-white/5 font-bold">目前沒有任何申訴案件</div>
              ) : appeals.map(appeal => (
                <div key={appeal._id} className="bg-black/40 border border-white/10 p-5 rounded-xl">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-cyan-400 text-lg">{appeal.userName}</span>
                      <span className="text-xs text-gray-500">{new Date(appeal.createdAt).toLocaleString()}</span>
                      {appeal.status === 'pending' && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-500/30">待處理</span>}
                      {appeal.status === 'approved' && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30">已核准解封</span>}
                      {appeal.status === 'rejected' && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs border border-red-500/30">已駁回</span>}
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg text-gray-200 text-sm whitespace-pre-wrap mb-4">
                    {appeal.reason}
                  </div>
                  {appeal.status === 'pending' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAppealAction(appeal._id, 'approve')}
                        className="px-4 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg border border-green-500/30 text-sm font-bold transition-colors"
                      >
                        ✅ 核准解封
                      </button>
                      <button 
                        onClick={() => handleAppealAction(appeal._id, 'reject')}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg border border-red-500/30 text-sm font-bold transition-colors"
                      >
                        ❌ 駁回申訴
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 封鎖管理彈窗 */}
      {banModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-red-500/30 p-6 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black text-red-400 mb-4 flex items-center gap-2">
              <span>🚫</span> 停權處分設定
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-2 font-bold text-sm">停權天數</label>
                <select 
                  value={banDays} 
                  onChange={e => setBanDays(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="1">1 天</option>
                  <option value="3">3 天</option>
                  <option value="7">7 天</option>
                  <option value="permanent">永久封鎖</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 mb-2 font-bold text-sm">處分理由 (將顯示在通知信與攔截畫面)</label>
                <textarea 
                  value={banReason} 
                  onChange={e => setBanReason(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-red-500 min-h-[100px] resize-none"
                  placeholder="例如：嚴重違反社群發言規範..."
                ></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setBanModalOpen(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={submitBan}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/20"
                >
                  執行封鎖
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
