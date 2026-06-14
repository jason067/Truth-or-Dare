import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
let socket;

export default function BuckshotRoulette() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nickname, setNickname] = useState(user?.name || '');
  const [roomCodeInput, setRoomCodeInput] = useState(() => {
    return new URLSearchParams(window.location.search).get('roomCode') || '';
  });
  
  const [isJoined, setIsJoined] = useState(false);
  const [room, setRoom] = useState(null);
  
  const [myId, setMyId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [myRoomCode, setMyRoomCode] = useState('');
  
  const [showQrModal, setShowQrModal] = useState(false);

  const [actionLog, setActionLog] = useState([]);
  const [shellStats, setShellStats] = useState(null);
  const [gameOverInfo, setGameOverInfo] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!user) {
      alert("請先登入！");
      navigate('/');
      return;
    }

    const fetchUserData = async () => {
      try {
        const id = user.googleId || user.id || user._id;
        const res = await fetch(`${BACKEND_URL}/api/user/${id}`);
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUserData();

    socket = io(BACKEND_URL);

    socket.on('joinSuccess', ({ playerId, isHost, roomCode }) => {
      setMyId(playerId);
      setIsHost(isHost);
      setMyRoomCode(roomCode);
      setIsJoined(true);
    });

    socket.on('roomUpdated', (updatedRoom) => {
      setRoom(updatedRoom);
      const me = updatedRoom.players.find(p => p.socketId === socket.id);
      if (me) setIsHost(me.isHost);
      if (updatedRoom.status === 'waiting') setGameOverInfo(null);
    });

    socket.on('buckshotGameStarted', ({ shellStats }) => {
      setShellStats(shellStats);
      setActionLog([{ type: 'system', text: `遊戲開始！槍膛裝入了 ${shellStats.live} 發實彈與 ${shellStats.blank} 發空包彈。` }]);
      setGameOverInfo(null);
    });

    socket.on('buckshotShootResult', ({ shooterId, targetId, bullet, damageDealt }) => {
      setActionLog(prev => {
        const newLog = [...prev, { type: bullet, text: `玩家開火！射出的是 ${bullet === 'live' ? '🔴 實彈' : '⚪ 空包彈'}！` }];
        if (newLog.length > 5) newLog.shift();
        return newLog;
      });
    });

    socket.on('buckshotReloading', () => {
      setActionLog(prev => [...prev, { type: 'system', text: '重新裝彈中...' }]);
    });

    socket.on('buckshotReloaded', ({ shellStats }) => {
      setShellStats(shellStats);
      setActionLog(prev => [...prev, { type: 'system', text: `已重新裝彈：${shellStats.live} 發實彈，${shellStats.blank} 發空包彈。` }]);
    });

    socket.on('buckshotGameOver', ({ winnerId }) => {
      setGameOverInfo({ winnerId });
      setActionLog(prev => [...prev, { type: 'system', text: '遊戲結束！' }]);
      fetchUserData(); // 遊戲結束後更新金幣
    });

    socket.on('error', ({ message }) => {
      alert(message);
    });

    socket.on('kickedOut', () => {
      alert("你已被房主無情地永久踢出！");
      navigate('/');
    });

    socket.on('forceClose', (data) => {
      alert(`⚠️ ${data.message}`);
      navigate('/');
    });

    socket.on('systemBroadcast', (data) => {
      alert(`📢 系統廣播：\n${data.message}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, navigate]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert("請輸入暱稱！");
    socket.emit('createRoom', { nickname: nickname.trim(), gameType: 'buckshot', userId: user.googleId || user.id });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert("請輸入暱稱！");
    if (!roomCodeInput.trim()) return alert("請輸入房號！");
    socket.emit('joinRoom', { 
      roomCode: roomCodeInput.trim().toUpperCase(), 
      nickname: nickname.trim(),
      userId: user.googleId || user.id
    });
  };

  const handleLeaveRoom = () => {
    socket.disconnect();
    navigate('/');
  };

  const handleStartGame = () => {
    socket.emit('startBuckshotGame', { roomCode: myRoomCode });
  };

  const handleKick = (targetId) => {
    if (window.confirm("確定要踢出這位玩家？(踢出後無法再加入)")) {
      socket.emit('kickPlayer', { roomCode: myRoomCode, targetId });
    }
  };

  const handleShoot = (targetId) => {
    socket.emit('buckshotShoot', { roomCode: myRoomCode, targetId });
  };

  const [selectedItemIndex, setSelectedItemIndex] = useState(null);

  const handleUseItem = (itemIndex, itemType) => {
    if (!isMyTurn) return;
    if (itemType === 'skip' || itemType === 'steal') {
      if (selectedItemIndex === itemIndex) {
        setSelectedItemIndex(null); // 取消選擇
      } else {
        setSelectedItemIndex(itemIndex); // 進入選擇目標模式
      }
    } else {
      socket.emit('buckshotUseItem', { roomCode: myRoomCode, itemIndex });
      setSelectedItemIndex(null);
    }
  };

  const handleTargetSelect = (targetId) => {
    if (selectedItemIndex !== null) {
      socket.emit('buckshotUseItem', { roomCode: myRoomCode, itemIndex: selectedItemIndex, targetId });
      setSelectedItemIndex(null);
    } else {
      handleShoot(targetId);
    }
  };

  const getItemInfo = (type) => {
    switch (type) {
      case 'peek': return { icon: '👁️', label: '偷看彈丸' };
      case 'shuffle': return { icon: '🔀', label: '重新排列' };
      case 'skip': return { icon: '🔗', label: '手銬(跳過)' };
      case 'heal': return { icon: '🩹', label: '治療' };
      case 'steal': return { icon: '🧤', label: '偷竊' };
      default: return { icon: '?', label: '未知' };
    }
  };

  const handleOpenCase = async () => {
    try {
      const id = user.googleId || user.id || user._id;
      const res = await fetch(`${BACKEND_URL}/api/store/case/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`🎉 開箱成功！獲得了: ${data.item.name} (${data.item.rarity})`);
        setUserData(prev => ({ ...prev, coins: data.coins, inventory: data.inventory }));
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('開箱發生錯誤');
    }
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* 左側：房間控制 */}
          <div className="space-y-6">
            <div className="text-center md:text-left space-y-2 mb-8">
              <h1 className="text-4xl font-black text-red-500 tracking-tight">Buckshot Roulette</h1>
              <p className="text-gray-400">心靈與機率的博弈</p>
            </div>

            <div className="bg-[#111] p-6 rounded-3xl border border-white/5 space-y-6">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="你的遊戲暱稱"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                />
                
                <button 
                  onClick={handleCreateRoom}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/20"
                >
                  建立新對決
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#111] text-gray-500">或加入現有房間</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="輸入房間代碼"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl p-4 text-white uppercase placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                    maxLength={6}
                  />
                  <button 
                    onClick={handleJoinRoom}
                    className="px-8 bg-white hover:bg-gray-200 text-black rounded-xl font-bold transition-colors"
                  >
                    加入
                  </button>
                </div>
              </div>
              
              <button 
                onClick={() => navigate('/')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl font-bold transition-colors"
              >
                返回大廳
              </button>
            </div>
          </div>

          {/* 右側：經濟與背包 */}
          <div className="space-y-6">
            <div className="bg-[#111] p-6 rounded-3xl border border-white/5">
              <h2 className="text-xl font-bold text-white mb-4">個人資訊與數據</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-sm mb-1">金幣餘額</div>
                  <div className="text-2xl font-black text-yellow-500">🪙 {userData?.coins || 0}</div>
                </div>
                <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-sm mb-1">戰績 (擊殺/死亡)</div>
                  <div className="text-2xl font-black text-red-400">
                    {userData?.trakStat?.kills || 0} / {userData?.trakStat?.deaths || 0}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-900/20 to-black p-6 rounded-xl border border-red-500/20 mb-6 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-lg font-bold text-white mb-2">軍火箱抽獎</h3>
                  <p className="text-sm text-gray-400 mb-4">花費 50 金幣，隨機獲得霰彈槍塗裝或噴漆。</p>
                  <button 
                    onClick={handleOpenCase}
                    className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
                  >
                    開啟箱子 (50 🪙)
                  </button>
                </div>
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-10">📦</div>
              </div>

              <h2 className="text-xl font-bold text-white mb-4">背包 (Inventory)</h2>
              <div className="bg-black/50 p-4 rounded-xl border border-white/5 min-h-[150px]">
                {userData?.inventory?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {userData.inventory.map((item, idx) => (
                      <div key={idx} className="bg-white/5 p-3 rounded-lg border border-white/10 text-sm">
                        <div className="font-bold">{item.name} <span className="text-gray-500">x{item.quantity}</span></div>
                        <div className={`text-xs ${item.rarity === 'Legendary' ? 'text-yellow-400' : item.rarity === 'Epic' ? 'text-purple-400' : 'text-blue-400'}`}>
                          {item.rarity}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">你的背包空空如也...</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // 遊戲畫面
  const gameState = room?.buckshotGameState;
  const isMyTurn = gameState && room.players[gameState.turnIndex]?._id === myId;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 頂部資訊區 */}
        <div className="flex justify-between items-center bg-[#111] p-4 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4">
            <button onClick={handleLeaveRoom} className="p-2 hover:bg-white/10 rounded-xl text-gray-400">⬅</button>
            <div>
              <div className="text-xs text-gray-500 font-bold tracking-wider">房號</div>
              <div className="text-xl font-black text-red-400">{myRoomCode}</div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setShowQrModal(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-bold">
              邀請
            </button>
            {isHost && room?.state === 'waiting' && (
              <button 
                onClick={handleStartGame}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20"
              >
                開始遊戲
              </button>
            )}
          </div>
        </div>

        {/* QR Code Modal */}
        {showQrModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQrModal(false)}>
            <div className="bg-[#111] p-8 rounded-3xl border border-white/10 text-center space-y-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-black text-white">邀請好友</h3>
              <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                <QRCodeSVG value={`${window.location.origin}/buckshot-roulette?roomCode=${myRoomCode}`} size={200} />
              </div>
              <p className="text-gray-400 text-sm">讓朋友掃描 QR Code 或輸入房號 <strong className="text-red-400 text-lg">{myRoomCode}</strong> 加入！</p>
              <button onClick={() => setShowQrModal(false)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold">關閉</button>
            </div>
          </div>
        )}

        {/* 遊戲狀態區 */}
        <div className="bg-[#111] p-6 rounded-3xl border border-white/5 text-center min-h-[500px] flex flex-col justify-center relative">
          {room?.state === 'waiting' ? (
            <div className="space-y-4">
              {gameOverInfo && (
                <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <h3 className="text-2xl font-black text-yellow-400">
                    勝出者: {room.players.find(p => p._id === gameOverInfo.winnerId)?.nickname || '無'}
                  </h3>
                </div>
              )}
              <h2 className="text-2xl font-black text-white">等待玩家加入... ({room.players.length}/4)</h2>
              <div className="flex flex-wrap justify-center gap-4">
                {room.players.map(p => (
                  <div key={p.socketId} className="bg-black/50 px-6 py-3 rounded-2xl border border-white/10 relative group">
                    <span className="font-bold text-gray-300">
                      {p.nickname} {p.isHost && <span className="text-red-500">⭐</span>}
                    </span>
                    {isHost && p.socketId !== socket.id && (
                      <button 
                        onClick={() => handleKick(p._id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : gameState ? (
            <div className="flex flex-col h-full justify-between">
              
              {/* 對手區域 */}
              <div className="flex justify-center gap-4 mb-8">
                {room.players.filter(p => p._id !== myId).map(p => {
                  const pState = gameState.playerStates.find(ps => ps._id === p._id);
                  return (
                    <div key={p._id} className={`bg-black/40 p-4 rounded-xl border ${pState?.isAlive ? 'border-red-900/50' : 'border-gray-800 opacity-50'} w-48 relative`}>
                      {pState?.skipTurns > 0 && (
                        <div className="absolute -top-3 -right-3 text-2xl" title="跳過回合">🔗</div>
                      )}
                      <div className="font-bold mb-2">{p.nickname}</div>
                      <div className="flex justify-center gap-1 mb-2">
                        {Array.from({ length: pState?.maxHp || 3 }).map((_, i) => (
                          <div key={i} className={`w-4 h-4 rounded-sm ${i < (pState?.hp || 0) ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-gray-800'}`} />
                        ))}
                      </div>
                      
                      {/* 對手的道具提示 (對方有幾個道具) */}
                      <div className="text-xs text-gray-500 mb-4 flex justify-center gap-1">
                        {pState?.items.map((_, i) => (
                          <div key={i} className="w-2 h-2 bg-gray-600 rounded-sm"></div>
                        ))}
                      </div>

                      {isMyTurn && pState?.isAlive && (
                        <button 
                          onClick={() => handleTargetSelect(p._id)}
                          className={`w-full py-2 rounded-lg text-sm font-bold border transition-colors ${selectedItemIndex !== null ? 'bg-blue-900/50 text-blue-200 border-blue-500/30 hover:bg-blue-600' : 'bg-red-900/50 text-red-200 border-red-500/30 hover:bg-red-600'}`}
                        >
                          {selectedItemIndex !== null ? '選擇目標 🎯' : '開火 🎯'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 中央桌面區 */}
              <div className="flex-1 flex flex-col justify-center items-center py-8">
                <div className="w-64 h-32 bg-green-900/20 rounded-[100%] border border-green-500/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative">
                  <div className="absolute top-2 text-xs text-gray-500 tracking-widest font-bold">SHOTGUN</div>
                  
                  {/* 動態提示 */}
                  {shellStats && (
                    <div className="text-sm font-bold flex gap-4 mt-2">
                      <span className="text-red-500">實彈 x{shellStats.live}</span>
                      <span className="text-gray-400">空包彈 x{shellStats.blank}</span>
                    </div>
                  )}
                  
                  <div className="mt-4 text-xs bg-black/50 px-4 py-2 rounded-full border border-white/5 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    {room.players[gameState.turnIndex]?.nickname} 的回合
                  </div>
                </div>

                {/* 行動日誌 */}
                <div className="mt-8 space-y-2 h-24 overflow-hidden w-full max-w-sm">
                  {actionLog.map((log, i) => (
                    <div key={i} className={`text-sm font-bold ${log.type === 'live' ? 'text-red-500' : log.type === 'blank' ? 'text-gray-400' : 'text-blue-400'}`}>
                      {log.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* 自己區域 */}
              <div className="mt-auto">
                <div className="max-w-sm mx-auto bg-black/60 p-6 rounded-2xl border border-white/10 relative">
                  {gameState.playerStates.find(p => p._id === myId)?.skipTurns > 0 && (
                    <div className="absolute -top-3 -right-3 text-2xl" title="跳過回合">🔗</div>
                  )}
                  <div className="flex justify-between items-center mb-4">
                    <div className="font-bold text-lg text-red-400">YOU</div>
                    <div className="flex gap-1">
                      {Array.from({ length: gameState.playerStates.find(p => p._id === myId)?.maxHp || 3 }).map((_, i) => {
                        const myHp = gameState.playerStates.find(p => p._id === myId)?.hp || 0;
                        return (
                          <div key={i} className={`w-6 h-6 rounded-sm ${i < myHp ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]' : 'bg-gray-800'}`} />
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* 自己擁有的道具 */}
                  <div className="flex gap-2 mb-4 justify-center">
                    {gameState.playerStates.find(p => p._id === myId)?.items.map((item, index) => {
                      const info = getItemInfo(item);
                      const isSelected = selectedItemIndex === index;
                      return (
                        <button
                          key={index}
                          onClick={() => handleUseItem(index, item)}
                          disabled={!isMyTurn || !gameState.playerStates.find(p => p._id === myId)?.isAlive}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${isSelected ? 'bg-blue-900/50 border-blue-500/50 scale-110 shadow-lg' : 'bg-white/5 border-white/10 hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={info.label}
                        >
                          <span className="text-xl">{info.icon}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  {isMyTurn && gameState.playerStates.find(p => p._id === myId)?.isAlive && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (selectedItemIndex !== null) setSelectedItemIndex(null);
                          else handleShoot(myId);
                        }}
                        className={`flex-1 py-3 rounded-xl font-bold transition-colors border ${selectedItemIndex !== null ? 'bg-gray-800 text-gray-400 border-gray-600' : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600'}`}
                      >
                        {selectedItemIndex !== null ? '取消選擇' : '對自己開槍 🔫'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
