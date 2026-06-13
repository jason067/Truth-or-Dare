import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
let socket;

export default function Spy() {
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
  
  const [myRole, setMyRole] = useState('');
  const [myWord, setMyWord] = useState('');
  const [showWord, setShowWord] = useState(false);
  const [voteTarget, setVoteTarget] = useState('');
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

    socket.on('spyGameStarted', ({ role, word }) => {
      setMyRole(role);
      setMyWord(word);
      setShowWord(false);
    });

    socket.on('error', ({ message }) => {
      alert(message);
    });

    socket.on('kickedOut', () => {
      alert("你已被房主無情地永久踢出！");
      window.location.href = '/';
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert("請輸入暱稱！");
    socket.emit('createRoom', { nickname: nickname.trim(), gameType: 'spy' });
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

  const handleLeaveRoom = () => {
    socket.disconnect();
    navigate('/');
  };

  const handleStartGame = () => {
    socket.emit('startSpyGame', { roomCode: myRoomCode });
  };

  const handleStartVoting = () => {
    socket.emit('startSpyVoting', { roomCode: myRoomCode });
  };

  const handleVote = (votedPlayerId) => {
    socket.emit('submitSpyVote', { roomCode: myRoomCode, votedPlayerId });
  };

  const handleRestart = () => {
    socket.emit('restartSpyGame', { roomCode: myRoomCode });
  };

  const handleKickPlayer = (targetId) => {
    if(window.confirm("確定要踢出這名玩家嗎？")) {
      socket.emit('kickPlayer', { roomCode: myRoomCode, targetId });
    }
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all z-20"
        >
          🔙 回大廳
        </button>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="text-center mb-12 z-10 w-full px-2">
          <h1 className="text-5xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gray-300 via-gray-500 to-red-500 drop-shadow-2xl mb-4 glow-text uppercase">
            誰是臥底
          </h1>
          <p className="text-lg md:text-xl text-gray-400 font-medium tracking-wide">
            🕵️ 派對心機大挑戰 ⚡
          </p>
        </div>

        <div className="w-full max-w-md glass-panel p-5 md:p-8 rounded-[2rem] z-10 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <form className="flex flex-col gap-4 md:gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-300 uppercase tracking-widest pl-2">您的派對暱稱</label>
              <input 
                type="text" 
                placeholder="輸入暱稱..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={10}
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-black/40 border-2 border-white/10 rounded-2xl text-white placeholder-gray-500 outline-none focus:border-red-500 focus:bg-black/60 transition-all font-semibold text-base md:text-lg"
              />
            </div>

            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent my-1 md:my-2"></div>

            <button 
              onClick={handleCreateRoom}
              className="w-full py-3 md:py-4 rounded-2xl bg-gradient-to-r from-gray-700 to-gray-900 text-white font-bold text-base md:text-lg hover:shadow-[0_0_20px_rgba(156,163,175,0.5)] border border-white/20 hover:-translate-y-1 transition-all"
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
                className="flex-grow min-w-0 px-3 md:px-5 py-3 md:py-4 bg-black/40 border-2 border-white/10 rounded-2xl text-white placeholder-gray-500 outline-none focus:border-red-500 text-center uppercase tracking-widest font-bold text-base md:text-lg transition-all"
              />
              <button 
                onClick={handleJoinRoom}
                className="px-4 md:px-6 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-red-600 to-red-800 text-white font-bold hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-white/20 hover:-translate-y-1 transition-all whitespace-nowrap text-sm md:text-base"
              >
                加入
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const isPlaying = room?.status === 'playing';
  const isVoting = room?.status === 'spy_voting';
  const isResult = room?.status === 'spy_result';

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 relative">
      {/* 頂部列 */}
      <header className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4 glass-panel rounded-2xl mb-4 md:mb-6 shadow-lg border border-white/5">
        <div className="flex items-center gap-3 md:gap-6">
          <h2 className="text-base md:text-xl font-bold text-gray-200 flex items-center">
            <span className="hidden sm:inline">房間號碼：</span>
            <span className="sm:hidden text-gray-400">房號:</span>
            <span className="text-red-400 tracking-widest font-black ml-1 md:ml-2">{myRoomCode}</span>
          </h2>
          <span className="bg-white/10 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-semibold border border-white/10 text-gray-200">
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
          <h3 className="text-lg font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-200 border-b border-white/10 pb-4">
            🏆 特務名單
          </h3>
          <div className="flex flex-col gap-3 max-h-[40vh] lg:max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {room?.players.map((p) => {
              const isMe = p._id === myId;
              const hasVoted = isVoting && room?.spyGameState?.votes[p._id];
              return (
                <div 
                  key={p._id} 
                  className={`relative p-4 rounded-2xl border transition-all duration-300
                    ${isMe ? 'bg-gray-800 border-gray-500/50' : 'bg-white/5 border-white/5'}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold flex items-center gap-2 text-gray-100">
                      {p.nickname}
                      {p.isHost && <span title="房主" className="text-yellow-400 text-sm">👑</span>}
                      {isMe && <span className="bg-red-600 text-xs px-2 py-0.5 rounded text-white">我</span>}
                    </span>
                    {isHost && !isMe && room?.status === 'waiting' && (
                      <button onClick={() => handleKickPlayer(p._id)} className="px-2 py-1 bg-white/10 text-gray-300 rounded hover:bg-red-500 hover:text-white transition-colors text-xs">🥾 踢出</button>
                    )}
                    {isVoting && hasVoted && <span className="text-xs text-green-400 font-bold">✓ 已投票</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右側：主遊戲展示面板 */}
        <main className="flex-grow glass-panel rounded-3xl border border-white/5 relative flex flex-col items-center justify-center p-6 lg:p-12 overflow-hidden shadow-2xl min-h-[500px]">
          
          {/* Waiting Phase */}
          {room?.status === 'waiting' && (
            <div className="flex flex-col items-center text-center max-w-md relative z-10 animate-fade-in">
              <div className="text-8xl mb-8">🕵️</div>
              {isHost ? (
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl font-black text-white drop-shadow-md">準備好抓臥底了嗎？</h3>
                  <p className="text-gray-400 font-medium">需要至少 3 人才能開始遊戲</p>
                  <button 
                    className={`mt-4 px-10 py-5 rounded-full font-black text-xl transition-all uppercase tracking-wider
                      ${room.players.length >= 3 
                        ? 'bg-gradient-to-r from-red-600 to-gray-800 text-white hover:scale-105 hover:shadow-[0_0_40px_rgba(220,38,38,0.6)] cursor-pointer' 
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'}`}
                    onClick={handleStartGame}
                    disabled={room.players.length < 3}
                  >
                    🎯 發牌開始遊戲
                  </button>
                  <button 
                    className="px-8 py-3 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-200 font-bold text-lg hover:bg-blue-500/40 transition-all w-full flex items-center justify-center gap-2 mt-2"
                    onClick={() => setShowQrModal(true)}
                  >
                    📱 顯示邀請 QR Code
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 bg-white/5 p-8 rounded-3xl border border-white/10 shadow-xl">
                  <h3 className="text-2xl font-black text-gray-200">等待房主發牌...</h3>
                  <p className="text-gray-400 font-medium text-lg">準備好你的演技了嗎？</p>
                </div>
              )}
            </div>
          )}

          {/* Playing Phase */}
          {isPlaying && (
            <div className="flex flex-col items-center text-center max-w-lg relative z-10 animate-fade-in w-full">
              <h3 className="text-3xl font-black text-white mb-8">🎭 你的詞彙 🎭</h3>
              
              <div 
                className="w-full aspect-[3/2] max-w-sm cursor-pointer perspective-1000"
                onClick={() => setShowWord(!showWord)}
              >
                <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${showWord ? 'rotate-y-180' : ''}`}>
                  {/* Card Front (Hidden) */}
                  <div className="absolute w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl border-2 border-gray-600 flex flex-col items-center justify-center backface-hidden shadow-xl">
                    <span className="text-6xl mb-4">👀</span>
                    <span className="text-gray-300 font-bold tracking-widest">長按或點擊查看</span>
                  </div>
                  
                  {/* Card Back (Revealed) */}
                  <div className="absolute w-full h-full bg-gradient-to-br from-red-900 to-black rounded-3xl border-2 border-red-500 flex flex-col items-center justify-center backface-hidden rotate-y-180 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                    <span className="text-sm text-gray-400 mb-2 uppercase tracking-widest">你的詞彙</span>
                    <span className="text-5xl md:text-6xl font-black text-white glow-text">{myWord}</span>
                  </div>
                </div>
              </div>

              <p className="text-gray-400 mt-8 mb-8 text-sm md:text-base">請大家輪流用一句話描述自己的詞，但不要直接說出來！</p>

              {isHost && (
                <button 
                  onClick={handleStartVoting}
                  className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  ⚖️ 進入投票階段
                </button>
              )}
            </div>
          )}

          {/* Voting Phase */}
          {isVoting && (
            <div className="flex flex-col items-center w-full animate-fade-in">
              <h3 className="text-3xl font-black text-white mb-2">⚖️ 揪出臥底 ⚖️</h3>
              <p className="text-gray-400 mb-8">請選擇你認為是臥底的玩家</p>

              {room?.spyGameState?.votes[myId] ? (
                <div className="text-xl text-green-400 font-bold animate-pulse mt-10">
                  ✓ 你已投票，等待其他人...
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
                  {room?.players.filter(p => p._id !== myId).map(p => (
                    <button
                      key={p._id}
                      onClick={() => handleVote(p._id)}
                      className="p-4 bg-gray-800 hover:bg-red-900/50 border border-gray-600 hover:border-red-500 rounded-2xl flex flex-col items-center transition-all"
                    >
                      <span className="text-4xl mb-2">👤</span>
                      <span className="text-white font-bold">{p.nickname}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Result Phase */}
          {isResult && (
            <div className="flex flex-col items-center text-center animate-fade-in w-full max-w-2xl">
              {room?.spyGameState?.tie ? (
                <>
                  <div className="text-6xl mb-4">🤷‍♂️</div>
                  <h3 className="text-4xl font-black text-yellow-500 mb-4 drop-shadow-lg">平手！</h3>
                  <p className="text-xl text-gray-300 mb-8">沒有人被淘汰，臥底逃過一劫！</p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">{room.spyGameState.isSpyEliminated ? '🎉' : '😱'}</div>
                  <h3 className={`text-4xl font-black mb-2 drop-shadow-lg ${room.spyGameState.isSpyEliminated ? 'text-green-500' : 'text-red-500'}`}>
                    {room.spyGameState.isSpyEliminated ? '平民獲勝！' : '臥底獲勝！'}
                  </h3>
                  <p className="text-xl text-gray-300 mb-6">
                    被處決的玩家是：<span className="font-bold text-white">{room.players.find(p => p._id === room.spyGameState.eliminatedId)?.nickname}</span>
                  </p>
                  
                  <div className="bg-white/10 p-6 rounded-2xl border border-white/20 w-full mb-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 mb-1">平民詞</div>
                        <div className="text-2xl font-bold text-white">{room.spyGameState.commonWord}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-1">臥底詞</div>
                        <div className="text-2xl font-bold text-red-400">{room.spyGameState.spyWord}</div>
                        <div className="text-sm text-gray-500 mt-1">臥底是：{room.players.find(p => p._id === room.spyGameState.spyId)?.nickname}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {isHost && (
                <button 
                  onClick={handleRestart}
                  className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white border border-gray-500 font-bold rounded-xl shadow-lg hover:scale-105 transition-all"
                >
                  🔄 再玩一局
                </button>
              )}
            </div>
          )}

        </main>
      </div>

      {/* QR Code 邀請 Modal */}
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
                value={`${window.location.origin}/spy?roomCode=${myRoomCode}`} 
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
