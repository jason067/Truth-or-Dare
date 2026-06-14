import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

export default function Home() {
  const navigate = useNavigate();
  const { user, loginUser, loginGuest, logoutUser } = useAuth();
  
  // 密碼鎖狀態
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [guestName, setGuestName] = useState('');

  // 大廳狀態
  const [socket, setSocket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [lobbyStatus, setLobbyStatus] = useState({ activeRoomsCount: 0, activePlayersCount: 0, leaderboard: [] });
  const chatEndRef = useRef(null);

  // 自動滾動聊天室
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!isUnlocked) return;

    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('lobbyMessage', (msg) => {
      setChatMessages(prev => [...prev, msg].slice(-50)); // 保留最後 50 則
    });

    newSocket.on('systemBroadcast', (data) => {
      alert(`📢 系統廣播：\n${data.message}`);
    });

    newSocket.on('error', (data) => {
      alert(`⚠️ 錯誤：\n${data.message}`);
      if (data.message.includes('封鎖')) {
         logoutUser();
         setIsUnlocked(false);
      }
    });
    
    // 如果聊天被管理員刪除
    newSocket.on('chatDeleted', (chatId) => {
      setChatMessages(prev => prev.filter(c => c._id !== chatId));
    });

    // 如果使用者被封鎖
    newSocket.on('userBanned', (bannedUserId) => {
      if (user && (user.id === bannedUserId || user.googleId === bannedUserId)) {
        alert('您已被管理員封鎖，將被強制登出。');
        logoutUser();
        setIsUnlocked(false);
      }
    });

    // 載入歷史聊天紀錄
    const fetchChatHistory = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/lobby/chat`);
        if (res.ok) {
          const history = await res.json();
          setChatMessages(history);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchChatHistory();

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/lobby/status`);
        if (res.ok) setLobbyStatus(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // 每 3 秒更新戰況

    return () => {
      newSocket.disconnect();
      clearInterval(interval);
    };
  }, [isUnlocked]);

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      loginUser({
        name: decoded.name,
        email: decoded.email,
        picture: decoded.picture,
        id: decoded.sub
      });

      try {
        await fetch(`${BACKEND_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: decoded.sub,
            name: decoded.name,
            email: decoded.email,
            picture: decoded.picture
          })
        });
      } catch (err) {}
    } catch (err) {}
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passcode === '6767') {
      setIsUnlocked(true);
    } else {
      setPasscodeError('邀請碼錯誤！禁止進入私人俱樂部。');
      setPasscode('');
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket || !user) return;
    
    socket.emit('sendLobbyMessage', { 
      userId: user.googleId || user.id, // Mongoose returns googleId, OAuth returns id
      user: user.name, 
      message: chatInput 
    });
    setChatInput('');
  };

  const games = [
    { id: 'truth-or-dare', title: '真心話大冒險', description: '看誰先不敢玩！', icon: '🃏', color: 'from-pink-500 via-purple-500 to-cyan-500', active: true },
    { id: 'spy', title: '誰是臥底', description: '找出那個與眾不同的人。', icon: '🕵️', color: 'from-gray-700 to-gray-900', active: true },
    { id: 'turtle-soup', title: '海龜湯', description: '還原離奇的真相。', icon: '🐢', color: 'from-green-700 to-emerald-900', active: true },
    { id: 'casino', title: '皇家賭場', description: '生死骰子，贏家通吃！', icon: '🎰', color: 'from-yellow-600 to-amber-800', active: true },
  ];

  // ==========================================
  // 鎖定畫面 (Lock Screen)
  // ==========================================
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black text-white">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[100px]"></div>
        
        <div className="relative z-10 glass-panel p-10 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full text-center">
          <div className="text-6xl mb-6">🏰</div>
          <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
            PARTY HUB
          </h1>
          <p className="text-gray-400 font-bold mb-8 text-sm">請輸入私人邀請碼解鎖</p>

          <form onSubmit={handleUnlock}>
            <input 
              type="password" 
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-cyan-500 transition-colors mb-4"
              placeholder="••••"
              maxLength={4}
              autoFocus
            />
            {passcodeError && <p className="text-red-400 text-sm font-bold mb-4">{passcodeError}</p>}
            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
            >
              解鎖大廳
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // 身分選擇畫面 (Login or Guest)
  // ==========================================
  if (isUnlocked && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black text-white">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[100px]"></div>
        
        <div className="relative z-10 glass-panel p-10 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full text-center">
          <h2 className="text-2xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">選擇您的身分</h2>
          
          <div className="mb-8">
            <p className="text-gray-400 text-xs font-bold mb-4">使用 Google 快速登入，保存您的戰績</p>
            <div className="flex justify-center shadow-lg rounded-full overflow-hidden border border-white/10">
              <GoogleLogin onSuccess={handleLoginSuccess} onError={() => {}} shape="pill" theme="filled_black" text="signin_with" />
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="h-px bg-white/10 flex-1"></div>
            <span className="text-gray-500 font-bold text-xs">或者</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!guestName.trim()) return alert('請輸入暱稱！');
            const res = await loginGuest(guestName);
            if (!res.success) alert(res.error);
          }}>
            <p className="text-gray-400 text-xs font-bold mb-4">以訪客身分快速遊玩</p>
            <input 
              type="text" 
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-center text-white focus:outline-none focus:border-purple-500 transition-colors mb-4"
              placeholder="輸入您的暱稱"
              maxLength={15}
            />
            <button 
              type="submit" 
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all border border-white/10"
            >
              訪客進入大廳
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // 解鎖後的主大廳 (Unlocked Lobby)
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col xl:flex-row bg-black text-white p-4 gap-4 relative overflow-hidden">
      {/* 裝飾背景 */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* 左側：大廳聊天室 */}
      <div className="xl:w-1/4 h-[400px] xl:h-auto glass-panel rounded-3xl border border-white/10 flex flex-col relative z-10 overflow-hidden order-2 xl:order-1">
        <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-black text-lg text-cyan-400 flex items-center gap-2">
            <span>💬</span> 全服大廳聊天室
          </h3>
          <button 
            onClick={() => document.getElementById('game-hub')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg shadow-purple-500/20 animate-pulse"
          >
            🎲 揪團開房
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-10 font-bold">目前還沒有人講話，來打個招呼吧！</div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-bold text-cyan-300 text-sm">{msg.user}</span>
                  <span className="text-[10px] text-gray-500">{new Date(msg.time).toLocaleTimeString()}</span>
                </div>
                {msg.type === 'invite' ? (
                  <div className="bg-black/40 border border-purple-500/30 p-3 rounded-xl mt-2">
                    <p className="text-purple-300 font-bold text-sm mb-2">{msg.message}</p>
                    <button 
                      onClick={() => navigate(`/${msg.payload?.gameType}?join=${msg.payload?.roomCode}`)}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-1.5 px-4 rounded-lg shadow-lg shadow-purple-500/20"
                    >
                      點擊加入 [{msg.payload?.roomCode}]
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-200 text-sm break-words">{msg.message}</div>
                )}
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="p-3 bg-black/40 border-t border-white/10 flex gap-2">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="說點什麼..."
            className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-cyan-500"
          />
          <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-xl font-bold transition-colors">
            送出
          </button>
        </form>
      </div>

      {/* 中間：遊戲列表與認證 */}
      <div id="game-hub" className="xl:w-2/4 flex flex-col relative z-10 order-1 xl:order-2 h-[85vh] xl:h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar pr-2">
        <div className="flex justify-between items-center mb-8 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
          <div className="text-center md:text-left md:ml-4">
            <h1 className="text-3xl md:text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 glow-text">
              PARTY HUB
            </h1>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-gray-300 font-bold text-sm hidden md:inline">{user.name}</span>
              <img src={user.picture} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-cyan-500" />
              <button onClick={logoutUser} className="text-xs bg-red-500/20 text-red-300 px-3 py-1.5 rounded-full hover:bg-red-500 hover:text-white transition-colors border border-red-500/30 font-bold">
                登出
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {games.map(game => (
            <div 
              key={game.id}
              onClick={() => game.active && navigate(`/${game.id}`)}
              className="relative overflow-hidden rounded-[2rem] p-6 flex flex-col items-center text-center transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] glass-panel border border-white/10 group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
              <div className="text-5xl mb-4 relative z-10 drop-shadow-lg transform group-hover:scale-110 transition-transform">{game.icon}</div>
              <h2 className="text-xl font-black text-white mb-2 relative z-10 tracking-wider">{game.title}</h2>
              <p className="text-gray-400 text-sm font-medium relative z-10">{game.description}</p>
              <button className="mt-6 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition-all w-full text-sm">
                進入遊戲
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 右側：戰況看板與排行榜 */}
      <div className="xl:w-1/4 flex flex-col gap-4 relative z-10 order-3 h-auto">
        {/* 伺服器狀態 */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10">
          <h3 className="font-black text-lg text-purple-400 flex items-center gap-2 mb-4">
            <span>📊</span> 即時戰況
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
              <div className="text-3xl font-black text-cyan-400">{lobbyStatus.activeRoomsCount}</div>
              <div className="text-xs text-gray-500 font-bold mt-1">火熱房間</div>
            </div>
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
              <div className="text-3xl font-black text-pink-400">{lobbyStatus.activePlayersCount}</div>
              <div className="text-xs text-gray-500 font-bold mt-1">在線玩家</div>
            </div>
          </div>
        </div>

        {/* 富豪排行榜 */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex-1 flex flex-col overflow-hidden">
          <h3 className="font-black text-lg text-yellow-400 flex items-center gap-2 mb-4">
            <span>🏆</span> 伺服器富豪榜
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {lobbyStatus.leaderboard.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-4 font-bold">目前還沒有玩家在遊戲中。</div>
            ) : (
              lobbyStatus.leaderboard.map((player, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm
                      ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 
                        idx === 1 ? 'bg-gray-300/20 text-gray-300 border border-gray-400/50' :
                        idx === 2 ? 'bg-amber-700/20 text-amber-500 border border-amber-600/50' :
                        'bg-white/5 text-gray-500'}`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{player.nickname}</div>
                      <div className="text-[10px] text-gray-500">在房間 {player.roomCode}</div>
                    </div>
                  </div>
                  <div className="text-yellow-400 font-black text-sm">
                    🪙 {player.coins}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
