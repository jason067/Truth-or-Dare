import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
let socket;

export default function TurtleSoup() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState(() => {
    return new URLSearchParams(window.location.search).get('roomCode') || '';
  });
  const [isJoined, setIsJoined] = useState(false);
  const [room, setRoom] = useState(null);
  
  const [myId, setMyId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [myRoomCode, setMyRoomCode] = useState('');
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
    socket.emit('createRoom', { nickname: nickname.trim(), gameType: 'turtle_soup' });
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
    socket.emit('startTurtleGame', { roomCode: myRoomCode });
  };

  const handleRevealAnswer = () => {
    socket.emit('revealTurtleAnswer', { roomCode: myRoomCode });
  };

  const handleKickPlayer = (targetId) => {
    if(window.confirm("確定要踢出這名玩家嗎？")) {
      socket.emit('kickPlayer', { roomCode: myRoomCode, targetId });
    }
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-gradient-to-br from-green-900 to-black overflow-hidden">
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all z-20"
        >
          🔙 回大廳
        </button>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="text-center mb-12 z-10 w-full px-2">
          <h1 className="text-5xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 drop-shadow-2xl mb-4 glow-text">
            海龜湯
          </h1>
          <p className="text-lg md:text-xl text-green-200 font-medium tracking-wide">
            🐢 水平思考 ‧ 懸疑解謎 🔍
          </p>
        </div>

        <div className="w-full max-w-md glass-panel p-5 md:p-8 rounded-[2rem] z-10 border border-green-500/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] bg-black/60">
          <form className="flex flex-col gap-4 md:gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-green-300 uppercase tracking-widest pl-2">偵探代號</label>
              <input 
                type="text" 
                placeholder="輸入暱稱..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={10}
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-black/60 border-2 border-green-500/30 rounded-2xl text-green-100 placeholder-green-800 outline-none focus:border-green-400 transition-all font-semibold text-base md:text-lg"
              />
            </div>

            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-green-500/30 to-transparent my-1 md:my-2"></div>

            <button 
              onClick={handleCreateRoom}
              className="w-full py-3 md:py-4 rounded-2xl bg-gradient-to-r from-green-700 to-emerald-900 text-white font-bold text-base md:text-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-green-500/30 hover:-translate-y-1 transition-all"
            >
              🍲 建立新湯鍋 (當主持人)
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
                className="flex-grow min-w-0 px-3 md:px-5 py-3 md:py-4 bg-black/60 border-2 border-green-500/30 rounded-2xl text-green-100 placeholder-green-800 outline-none focus:border-green-400 text-center uppercase tracking-widest font-bold text-base md:text-lg transition-all"
              />
              <button 
                onClick={handleJoinRoom}
                className="px-4 md:px-6 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-800 text-white font-bold hover:shadow-[0_0_20px_rgba(20,184,166,0.5)] border border-teal-500/30 hover:-translate-y-1 transition-all whitespace-nowrap text-sm md:text-base"
              >
                加入
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const isPlaying = room?.status === 'turtle_playing';
  const isRevealed = room?.status === 'turtle_revealed';
  const gameState = room?.turtleGameState;

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 relative bg-gradient-to-br from-gray-900 to-black text-green-50">
      {/* 頂部列 */}
      <header className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4 glass-panel rounded-2xl mb-4 md:mb-6 shadow-lg border border-green-500/20 bg-black/40">
        <div className="flex items-center gap-3 md:gap-6">
          <h2 className="text-base md:text-xl font-bold text-green-200 flex items-center">
            <span className="hidden sm:inline">房號：</span>
            <span className="text-emerald-400 tracking-widest font-black ml-1 md:ml-2">{myRoomCode}</span>
          </h2>
          <span className="bg-green-900/40 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-semibold border border-green-500/30 text-green-200">
            👥 {room?.players.length} 人
          </span>
        </div>
        <button 
          className="px-4 py-2 md:px-5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-colors text-sm md:text-base"
          onClick={handleLeaveRoom}
        >
          🚪 離開
        </button>
      </header>

      <div className="flex flex-col-reverse lg:flex-row gap-6 flex-grow">
        
        {/* 左側：玩家清單面板 */}
        <aside className="w-full lg:w-80 glass-panel rounded-3xl p-6 flex flex-col gap-4 shadow-xl border border-green-500/20 bg-black/40 h-fit lg:sticky lg:top-8">
          <h3 className="text-lg font-black uppercase tracking-widest text-green-400 border-b border-green-500/20 pb-4">
            🔍 偵探名單
          </h3>
          <div className="flex flex-col gap-3 max-h-[40vh] lg:max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {room?.players.map((p) => {
              const isMe = p._id === myId;
              return (
                <div 
                  key={p._id} 
                  className={`relative p-4 rounded-2xl border transition-all duration-300
                    ${isMe ? 'bg-green-900/40 border-green-500/50' : 'bg-white/5 border-white/5'}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold flex items-center gap-2 text-green-100">
                      {p.nickname}
                      {p.isHost && <span title="主持人" className="text-yellow-400 text-sm">👑</span>}
                      {isMe && <span className="bg-emerald-600 text-xs px-2 py-0.5 rounded text-white">我</span>}
                    </span>
                    {isHost && !isMe && room?.status === 'waiting' && (
                      <button onClick={() => handleKickPlayer(p._id)} className="px-2 py-1 bg-white/10 text-gray-300 rounded hover:bg-red-500 hover:text-white transition-colors text-xs">🥾 踢出</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右側：主遊戲展示面板 */}
        <main className="flex-grow glass-panel rounded-3xl border border-green-500/20 bg-black/40 relative flex flex-col items-center justify-center p-6 lg:p-12 overflow-hidden shadow-2xl min-h-[500px]">
          
          {/* Waiting Phase */}
          {room?.status === 'waiting' && (
            <div className="flex flex-col items-center text-center max-w-md relative z-10 animate-fade-in">
              <div className="text-8xl mb-8">🍲</div>
              {isHost ? (
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl font-black text-green-100 drop-shadow-md">你是主持人</h3>
                  <p className="text-green-400/80 font-medium">當大家都準備好發問時，點擊下方按鈕開始熬湯！</p>
                  <button 
                    className="px-10 py-5 rounded-full font-black text-2xl transition-all uppercase tracking-wider bg-white text-black hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.4)]"
                    onClick={handleStartGame}
                  >
                    🚀 出題並開始遊戲
                  </button>
                  <button 
                    className="px-8 py-3 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-200 font-bold text-lg hover:bg-blue-500/40 transition-all w-full flex items-center justify-center gap-2 mt-2"
                    onClick={() => setShowQrModal(true)}
                  >
                    📱 顯示邀請 QR Code
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 bg-green-900/20 p-8 rounded-3xl border border-green-500/20 shadow-xl">
                  <h3 className="text-2xl font-black text-green-200">等待主持人出題...</h3>
                  <p className="text-green-400/70 font-medium text-lg">準備好你的邏輯推理能力了嗎？</p>
                </div>
              )}
            </div>
          )}

          {/* Playing / Revealed Phase */}
          {(isPlaying || isRevealed) && gameState && (
            <div className="flex flex-col w-full max-w-3xl relative z-10 animate-fade-in">
              <h3 className="text-3xl font-black text-green-400 mb-6 text-center border-b border-green-500/30 pb-4">
                {gameState.title}
              </h3>
              
              <div className="bg-gray-900/80 p-6 rounded-2xl border border-gray-700 shadow-inner mb-6">
                <h4 className="text-gray-400 text-sm font-bold tracking-widest mb-2 uppercase">【 湯面 】</h4>
                <p className="text-xl md:text-2xl text-gray-100 leading-relaxed font-serif">
                  {gameState.surface}
                </p>
              </div>

              {isRevealed && (
                <div className="bg-red-900/20 p-6 rounded-2xl border border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.2)] mb-6 animate-fade-in">
                  <h4 className="text-red-400 text-sm font-bold tracking-widest mb-2 uppercase">【 湯底 (解答) 】</h4>
                  <p className="text-xl md:text-2xl text-red-100 leading-relaxed font-serif whitespace-pre-wrap">
                    {gameState.bottom}
                  </p>
                </div>
              )}

              {/* Host Controls & Views */}
              {isHost && (
                <div className="mt-4 border-t border-green-500/30 pt-6">
                  {!isRevealed && (
                    <div className="bg-yellow-900/20 p-6 rounded-2xl border border-yellow-500/40 mb-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-500"></div>
                      <h4 className="text-yellow-400 text-sm font-bold tracking-widest mb-2 uppercase flex items-center gap-2">
                        <span>⚠️ 主持人專屬視角 (請勿給玩家看)</span>
                      </h4>
                      <p className="text-lg text-yellow-100 leading-relaxed font-serif whitespace-pre-wrap">
                        {gameState.bottom}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 justify-center">
                    {!isRevealed && (
                      <button 
                        onClick={handleRevealAnswer}
                        className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition-all text-lg"
                      >
                        📢 公布湯底
                      </button>
                    )}
                    <button 
                      onClick={handleStartGame}
                      className="px-8 py-4 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transition-all text-lg"
                    >
                      🎲 {isRevealed ? '下一碗湯' : '換一碗湯'}
                    </button>
                  </div>
                </div>
              )}

              {!isHost && !isRevealed && (
                <div className="mt-8 text-center">
                  <p className="text-green-400/80 animate-pulse text-lg">
                    向主持人提出「是」或「否」的問題來找出真相吧！
                  </p>
                </div>
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
                value={`${window.location.origin}/turtle-soup?roomCode=${myRoomCode}`} 
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
