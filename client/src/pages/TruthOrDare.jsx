import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import TruthOrDareCard from '../components/TruthOrDareCard';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
let socket;

export default function TruthOrDare() {
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
  
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [currentChoice, setCurrentChoice] = useState(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinningName, setSpinningName] = useState('');
  const [showDesignateModal, setShowDesignateModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
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
    });

    socket.on('wheelSpun', ({ selectedPlayerId, selectedPlayerName, room: updatedRoom }) => {
      setIsSpinning(true);
      setCurrentChoice(null);
      setCurrentPrompt('');
      setIsCardFlipped(false);
      
      const playerNames = updatedRoom.players.map(p => p.nickname);
      if(playerNames.length === 0) return;

      let count = 0;
      const interval = setInterval(() => {
        setSpinningName(playerNames[count % playerNames.length]);
        count++;
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        setIsSpinning(false);
        setSpinningName('');
        setSelectedPlayer({ id: selectedPlayerId, name: selectedPlayerName });
        setRoom(updatedRoom);
      }, 2500);
    });

    socket.on('choiceSelected', ({ selectedPlayerId, selectedPlayerName, choice, questionPrompt, room: updatedRoom }) => {
      setCardLoading(true);
      setCurrentChoice(choice);
      
      setTimeout(() => {
        setCardLoading(false);
        setCurrentPrompt(questionPrompt);
        setIsCardFlipped(true);
        setRoom(updatedRoom);
      }, 1000);
    });

    socket.on('promptRerolled', ({ selectedPlayerId, questionPrompt, room: updatedRoom }) => {
      setCardLoading(true);
      setTimeout(() => {
        setCurrentPrompt(questionPrompt);
        setRoom(updatedRoom);
        setCardLoading(false);
      }, 800);
    });

    socket.on('roundCompleted', ({ playerId, nickname, room: updatedRoom }) => {
      setIsCardFlipped(false);
      setTimeout(() => {
        setCurrentChoice(null);
        setCurrentPrompt('');
        setSelectedPlayer(null);
        setRoom(updatedRoom);
      }, 500);
    });

    socket.on('error', ({ message }) => {
      alert(message);
    });

    socket.on('kickedOut', () => {
      alert('你已被踢出房間！');
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
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert("請輸入暱稱！");
    socket.emit('createRoom', { nickname: nickname.trim() });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert("請輸入暱稱！");
    if (!roomCodeInput.trim()) return alert("請輸入房號！");
    socket.emit('joinRoom', { 
      roomCode: roomCodeInput.trim().toUpperCase(), 
      nickname: nickname.trim() 
    });
  };

  const handleSpinWheel = (targetId = null) => {
    if (isSpinning) return;
    socket.emit('spinWheel', { roomCode: myRoomCode, targetId });
  };

  const handleSelectChoice = (choice) => {
    socket.emit('selectChoice', { roomCode: myRoomCode, choice });
  };

  const handleCompleteRound = () => {
    socket.emit('completeRound', { roomCode: myRoomCode });
  };

  const handleSkipPrompt = () => {
    socket.emit('skipPrompt', { roomCode: myRoomCode });
  };

  const handleLeaveRoom = () => {
    socket.disconnect();
    navigate('/');
  };

  const handleKickPlayer = (targetId) => {
    if(window.confirm("確定要踢出這名玩家嗎？")) {
      socket.emit('kickPlayer', { roomCode: myRoomCode, targetId });
    }
  };

  const handleAppealKick = () => {
    socket.emit('appealKick', { roomCode: myRoomCode });
  };

  const handleResolveAppeal = (targetId, accept) => {
    socket.emit('resolveAppeal', { roomCode: myRoomCode, targetId, accept });
  };

  const getMyPoints = () => {
    if (!room) return 100;
    const me = room.players.find(p => p._id === myId);
    return me ? me.points : 100;
  };

  const isMyTurn = selectedPlayer && selectedPlayer.id === myId;

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all z-20"
        >
          🔙 回大廳
        </button>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="text-center mb-12 z-10 w-full px-2">
          <h1 className="text-5xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 drop-shadow-2xl mb-4 glow-text uppercase">
            Truth <span className="text-white text-4xl md:text-6xl">or</span> Dare
          </h1>
          <p className="text-lg md:text-xl text-purple-200 font-medium tracking-wide">
            🎮 終極多人派對連線版 ⚡
          </p>
        </div>

        <div className="w-full max-w-md glass-panel p-5 md:p-8 rounded-[2rem] z-10 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <form className="flex flex-col gap-4 md:gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-indigo-300 uppercase tracking-widest pl-2">您的派對暱稱</label>
              <input 
                type="text" 
                placeholder="輸入超酷的暱稱..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={10}
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-black/40 border-2 border-white/10 rounded-2xl text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:bg-black/60 transition-all font-semibold text-base md:text-lg"
              />
            </div>

            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent my-1 md:my-2"></div>

            <button 
              onClick={handleCreateRoom}
              className="w-full py-3 md:py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-base md:text-lg hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] hover:-translate-y-1 transition-all"
            >
              ✨ 創立新房間
            </button>

            <div className="flex gap-2 md:gap-3 mt-1 md:mt-2">
              <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="輸入房號" 
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                className="flex-grow min-w-0 px-3 md:px-5 py-3 md:py-4 bg-black/40 border-2 border-white/10 rounded-2xl text-white placeholder-gray-500 outline-none focus:border-cyan-500 text-center uppercase tracking-widest font-bold text-base md:text-lg transition-all"
              />
              <button 
                onClick={handleJoinRoom}
                className="px-4 md:px-6 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:-translate-y-1 transition-all whitespace-nowrap text-sm md:text-base"
              >
                加入
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 relative">
      {/* 頂部列 */}
      <header className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4 glass-panel rounded-2xl mb-4 md:mb-6 shadow-lg">
        <div className="flex items-center gap-3 md:gap-6">
          <h2 className="text-base md:text-xl font-bold text-gray-200 flex items-center">
            <span className="hidden sm:inline">房間號碼：</span>
            <span className="sm:hidden text-gray-400">房號:</span>
            <span className="text-cyan-400 tracking-widest font-black ml-1 md:ml-2 glow-text">{myRoomCode}</span>
          </h2>
          <span className="bg-white/10 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-semibold border border-white/10 text-indigo-200 whitespace-nowrap">
            👥 {room?.players.filter(p => !['offline', 'kicked'].includes(p.status)).length} 人
          </span>
        </div>
        <button 
          className="px-4 py-2 md:px-5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-colors text-sm md:text-base"
          onClick={handleLeaveRoom}
        >
          🚪 回大廳
        </button>
      </header>

      <div className="flex flex-col-reverse lg:flex-row gap-6 flex-grow">
        
        {/* 左側：玩家清單面板 */}
        <aside className="w-full lg:w-80 glass-panel rounded-3xl p-6 flex flex-col gap-4 shadow-xl border border-white/5 h-fit lg:sticky lg:top-8">
          <h3 className="text-lg font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 border-b border-white/10 pb-4">
            🏆 派對成員
          </h3>
          <div className="flex flex-col gap-3 max-h-[40vh] lg:max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {room?.players.map((p) => {
              const isMe = p._id === myId;
              const isActive = ['selected', 'choosing', 'answering'].includes(p.status);
              const isOffline = p.status === 'offline';
              return (
                <div 
                  key={p._id} 
                  className={`relative p-4 rounded-2xl border transition-all duration-300
                    ${isMe ? 'bg-purple-900/30 border-purple-500/50' : 'bg-white/5 border-white/5'}
                    ${isActive ? 'shadow-[0_0_15px_rgba(0,240,255,0.3)] border-cyan-500/50' : ''}
                  `}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold flex items-center gap-2 text-gray-100">
                      {p.nickname}
                      {p.isHost && <span title="房主" className="text-yellow-400 text-sm">👑</span>}
                      {isMe && <span className="bg-purple-600 text-xs px-2 py-0.5 rounded text-white">我</span>}
                    </span>
                    <span className={`w-3 h-3 rounded-full shadow-lg ${
                      isActive ? 'bg-yellow-400 shadow-yellow-400/50 animate-pulse' :
                      isOffline ? 'bg-red-500' : 'bg-emerald-500'
                    }`}></span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1 text-xs font-semibold text-gray-400">
                      <span>✨ 得分: {p.score}</span>
                      <span className="text-yellow-500">🪙 {p.points}</span>
                    </div>
                    {isHost && !isMe && (
                      <div className="flex gap-2">
                        {p.status === 'appealing' ? (
                          <>
                            <button onClick={() => handleResolveAppeal(p._id, true)} className="px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/50 hover:bg-green-500 hover:text-white transition-colors text-xs font-bold shadow-[0_0_10px_rgba(34,197,94,0.3)]">准許</button>
                            <button onClick={() => handleResolveAppeal(p._id, false)} className="px-2 py-1 bg-red-500/20 text-red-400 rounded border border-red-500/50 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold shadow-[0_0_10px_rgba(239,68,68,0.3)]">踢除</button>
                          </>
                        ) : p.status === 'kicked' ? (
                          <span className="text-red-400 text-xs px-2 py-1 font-bold">已踢出</span>
                        ) : (
                          <button onClick={() => handleKickPlayer(p._id)} className="px-2 py-1 bg-white/10 text-gray-300 rounded hover:bg-red-500 hover:text-white transition-colors text-xs">🥾 踢出</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右側：主遊戲展示面板 */}
        <main className="flex-grow glass-panel rounded-3xl border border-white/5 relative flex items-center justify-center p-6 lg:p-12 overflow-hidden shadow-2xl min-h-[500px]">
          
          {/* 背景裝飾光暈 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-2xl max-h-2xl bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>

          {/* 1. 跑馬燈抽人動畫狀態 */}
          {isSpinning && (
            <div className="absolute inset-0 bg-party-dark/90 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="relative flex flex-col items-center">
                <div className="absolute w-[250px] h-[250px] border-[6px] border-dashed border-cyan-500/30 border-t-pink-500 border-b-cyan-500 rounded-full animate-[spin_2s_linear_infinite] blur-[1px]"></div>
                <div className="z-10 flex flex-col items-center">
                  <div className="text-xl text-indigo-300 font-bold mb-4 tracking-widest uppercase">命運的輪盤...</div>
                  <div className="text-5xl md:text-6xl font-black text-pink-500 drop-shadow-[0_0_20px_rgba(255,0,127,0.8)] glow-text">
                    {spinningName}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. 沒有正在進行的回合 (Room 等待狀態) */}
          {!isSpinning && room?.status === 'waiting' && (
            <div className="flex flex-col items-center text-center max-w-md relative z-10 animate-fade-in">
              <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/40 to-transparent rounded-full blur-xl animate-pulse"></div>
                <span className="text-7xl relative z-10 animate-bounce">🃏</span>
              </div>
              
              {isHost ? (
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl font-black text-white drop-shadow-md">你是房主，準備好抽人了嗎？</h3>
                  <p className="text-gray-400 font-medium">請選擇要隨機抽取，還是直接指定挑戰者！</p>
                  
                  <div className="mt-2 flex flex-col gap-3 w-full">
                    <button 
                      className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-black text-xl hover:scale-105 hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] transition-all uppercase tracking-wider w-full"
                      onClick={() => handleSpinWheel(null)}
                    >
                      🎲 隨機抽取玩家
                    </button>
                    <button 
                      className="px-8 py-3 rounded-full bg-white/10 border border-white/20 text-gray-200 font-bold text-lg hover:bg-white/20 transition-all w-full flex items-center justify-center gap-2"
                      onClick={() => setShowDesignateModal(true)}
                    >
                      🎯 房主指定玩家
                    </button>
                    <button 
                      className="px-8 py-3 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-200 font-bold text-lg hover:bg-blue-500/40 transition-all w-full flex items-center justify-center gap-2 mt-2"
                      onClick={() => setShowQrModal(true)}
                    >
                      📱 顯示邀請 QR Code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 bg-white/5 p-8 rounded-3xl border border-white/10 shadow-xl">
                  <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">等待房主啟動挑戰...</h3>
                  <p className="text-gray-400 font-medium text-lg">下一輪誰會被抽中呢？刺激刺激 👀</p>
                </div>
              )}
            </div>
          )}

          {/* 3. 當前有選中的人 (卡片顯示狀態) */}
          {!isSpinning && room?.status === 'playing' && selectedPlayer && (
            <div className="w-full h-full flex items-center justify-center animate-fade-in relative z-10">
              <TruthOrDareCard
                isMyTurn={isMyTurn}
                selectedPlayerName={selectedPlayer.name}
                points={getMyPoints()}
                choice={currentChoice}
                promptText={currentPrompt}
                loading={cardLoading}
                isFlipped={isCardFlipped}
                onSelectChoice={handleSelectChoice}
                onComplete={handleCompleteRound}
                onSkip={handleSkipPrompt}
              />
            </div>
          )}
        </main>
      </div>

      {/* 4. 被踢出遮罩 */}
      {(room?.players.find(p => p._id === myId)?.status === 'kicked' || room?.players.find(p => p._id === myId)?.status === 'appealing') && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="text-8xl mb-6">🥾</div>
          <h2 className="text-4xl md:text-5xl font-black text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
            你已被房主踢出房間！
          </h2>
          {room?.players.find(p => p._id === myId)?.status === 'kicked' && (
            <>
              <p className="text-xl text-gray-300 mb-8">覺得不公平嗎？向房主提出抗議！</p>
              <button 
                onClick={handleAppealKick}
                className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white text-xl font-bold rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all hover:scale-105"
              >
                🤬 我不服！(提出抗議)
              </button>
            </>
          )}
          {room?.players.find(p => p._id === myId)?.status === 'appealing' && (
            <div className="flex flex-col items-center mt-4">
              <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-2xl text-red-400 font-bold animate-pulse">抗議中... 等待房主開恩...</p>
            </div>
          )}
        </div>
      )}

      {/* 5. 房主指定玩家 Modal */}
      {showDesignateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border border-white/20 p-6 rounded-3xl w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowDesignateModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
            >
              ✕
            </button>
            <h3 className="text-2xl font-black text-white mb-6 text-center tracking-widest">選擇指定玩家</h3>
            <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              {room?.players.filter(p => !['offline', 'kicked', 'appealing'].includes(p.status)).map(p => (
                <button
                  key={p._id}
                  onClick={() => {
                    setShowDesignateModal(false);
                    handleSpinWheel(p._id);
                  }}
                  className="p-4 bg-white/5 hover:bg-purple-500/30 border border-white/10 hover:border-purple-500/50 rounded-xl text-left font-bold text-white transition-all flex justify-between items-center"
                >
                  <span className="text-lg">{p.nickname} {p._id === myId ? <span className="text-sm text-gray-400 ml-2">(自己)</span> : ''}</span>
                  <span className="text-xl">👉</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. QR Code 邀請 Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border border-white/20 p-8 rounded-3xl w-full max-w-sm shadow-2xl relative flex flex-col items-center">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
            >
              ✕
            </button>
            <h3 className="text-2xl font-black text-white mb-6 tracking-widest text-center">掃描加入遊戲</h3>
            <div className="bg-white p-4 rounded-xl mb-6 shadow-lg">
              <QRCodeSVG 
                value={`${window.location.origin}/truth-or-dare?roomCode=${myRoomCode}`} 
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"H"}
              />
            </div>
            <p className="text-gray-300 text-center font-medium">房號：<span className="text-xl text-white font-black">{myRoomCode}</span></p>
          </div>
        </div>
      )}

    </div>
  );
}
