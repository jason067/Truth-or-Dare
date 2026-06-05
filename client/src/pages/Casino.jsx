import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);
let socket;

export default function Casino() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [room, setRoom] = useState(null);
  
  const [myId, setMyId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [myRoomCode, setMyRoomCode] = useState('');

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
    socket.emit('createRoom', { nickname: nickname.trim(), gameType: 'casino' });
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

  const handleStartRound = () => {
    socket.emit('startCasinoRound', { roomCode: myRoomCode });
  };

  const handlePlaceBet = (amount) => {
    socket.emit('placeBet', { roomCode: myRoomCode, amount });
  };

  const handleRollDice = () => {
    socket.emit('rollCasinoDice', { roomCode: myRoomCode });
  };

  const handleClaimRelief = () => {
    socket.emit('claimReliefFund', { roomCode: myRoomCode });
  };

  const handleKickPlayer = (targetId) => {
    if(window.confirm("確定要踢出這名玩家嗎？")) {
      socket.emit('kickPlayer', { roomCode: myRoomCode, targetId });
    }
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-gradient-to-br from-yellow-900 to-black overflow-hidden">
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all z-20"
        >
          🔙 回大廳
        </button>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-600/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="text-center mb-12 z-10 w-full px-2">
          <h1 className="text-5xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 drop-shadow-2xl mb-4 glow-text">
            皇家賭場
          </h1>
          <p className="text-lg md:text-xl text-yellow-200 font-medium tracking-wide">
            🎲 生死骰子 ‧ 贏家通吃 💰
          </p>
        </div>

        <div className="w-full max-w-md glass-panel p-5 md:p-8 rounded-[2rem] z-10 border border-yellow-500/30 shadow-[0_0_50px_rgba(245,158,11,0.3)] bg-black/70">
          <form className="flex flex-col gap-4 md:gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-yellow-300 uppercase tracking-widest pl-2">賭徒代號</label>
              <input 
                type="text" 
                placeholder="輸入暱稱..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={10}
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-black/60 border-2 border-yellow-500/30 rounded-2xl text-yellow-100 placeholder-yellow-800 outline-none focus:border-yellow-400 transition-all font-semibold text-base md:text-lg"
              />
            </div>

            <button 
              onClick={handleCreateRoom}
              className="w-full py-3 md:py-4 rounded-2xl bg-gradient-to-r from-yellow-600 to-amber-700 text-white font-black text-base md:text-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-yellow-500/50 hover:-translate-y-1 transition-all"
            >
              👑 開設豪華包廂
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
                className="flex-grow min-w-0 px-3 md:px-5 py-3 md:py-4 bg-black/60 border-2 border-yellow-500/30 rounded-2xl text-yellow-100 placeholder-yellow-800 outline-none focus:border-yellow-400 text-center uppercase tracking-widest font-bold text-base md:text-lg transition-all"
              />
              <button 
                onClick={handleJoinRoom}
                className="px-4 md:px-6 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-800 text-white font-bold hover:shadow-[0_0_20px_rgba(249,115,22,0.5)] border border-orange-500/50 hover:-translate-y-1 transition-all whitespace-nowrap"
              >
                加入
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const isBetting = room?.status === 'casino_betting';
  const isResult = room?.status === 'casino_result';
  const gameState = room?.casinoGameState;
  
  const me = room?.players.find(p => p._id === myId);
  const myCoins = me?.coins || 0;
  const hasBet = me?.status === 'idle';

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 relative bg-gradient-to-br from-gray-900 via-zinc-900 to-black text-yellow-50">
      {/* 頂部列 */}
      <header className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4 glass-panel rounded-2xl mb-4 md:mb-6 shadow-lg border border-yellow-500/30 bg-black/50">
        <div className="flex items-center gap-3 md:gap-6">
          <h2 className="text-base md:text-xl font-bold text-yellow-200 flex items-center">
            <span className="hidden sm:inline">房號：</span>
            <span className="text-yellow-500 tracking-widest font-black ml-1 md:ml-2">{myRoomCode}</span>
          </h2>
          <span className="bg-yellow-900/40 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-semibold border border-yellow-500/30 text-yellow-200">
            👥 {room?.players.length} 人
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-yellow-500/20 px-4 py-2 rounded-xl border border-yellow-500/40 hidden sm:block">
            <span className="text-yellow-100 font-bold">💰 你的餘額: </span>
            <span className="text-yellow-400 font-black text-xl">{myCoins}</span>
          </div>
          <button 
            className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-colors text-sm md:text-base"
            onClick={handleLeaveRoom}
          >
            退出賭場
          </button>
        </div>
      </header>
      
      {/* 行動版餘額顯示 */}
      <div className="sm:hidden mb-4 bg-yellow-500/20 px-4 py-2 rounded-xl border border-yellow-500/40 flex justify-between items-center">
        <span className="text-yellow-100 font-bold">💰 你的餘額</span>
        <span className="text-yellow-400 font-black text-xl">${myCoins}</span>
      </div>

      <div className="flex flex-col-reverse lg:flex-row gap-6 flex-grow">
        {/* 左側：玩家清單面板 */}
        <aside className="w-full lg:w-80 glass-panel rounded-3xl p-6 flex flex-col gap-4 shadow-xl border border-yellow-500/20 bg-black/60 h-fit lg:sticky lg:top-8">
          <h3 className="text-lg font-black uppercase tracking-widest text-yellow-500 border-b border-yellow-500/20 pb-4">
            🎰 賭徒名單
          </h3>
          <div className="flex flex-col gap-3 max-h-[40vh] lg:max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {room?.players.map((p) => {
              const isMe = p._id === myId;
              const playerBet = gameState?.bets?.[p._id] || 0;
              const playerRoll = gameState?.rolls?.[p._id];
              const isWinner = gameState?.winners?.includes(p._id);

              return (
                <div 
                  key={p._id} 
                  className={`relative p-4 rounded-2xl border transition-all duration-300
                    ${isMe ? 'bg-yellow-900/40 border-yellow-500/50' : 'bg-white/5 border-white/10'}
                    ${isWinner && isResult ? 'bg-amber-600/40 border-amber-400 animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.5)]' : ''}
                  `}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold flex items-center gap-2 text-yellow-100">
                      {p.nickname}
                      {p.isHost && <span title="房主" className="text-yellow-400 text-sm">👑</span>}
                    </span>
                    <span className="text-yellow-400 font-black">💰 {p.coins}</span>
                  </div>

                  {(isBetting || isResult) && (
                    <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-white/10">
                      <span className="text-gray-400">
                        {p.status === 'idle' ? `已下注: ${playerBet}` : '思考中...'}
                      </span>
                      {isResult && playerRoll !== undefined && (
                        <span className="text-2xl font-black text-yellow-300 drop-shadow-md">
                          🎲 {playerRoll}
                        </span>
                      )}
                    </div>
                  )}

                  {isHost && !isMe && room?.status === 'waiting' && (
                    <button onClick={() => handleKickPlayer(p._id)} className="absolute -top-2 -right-2 px-2 py-1 bg-red-600/80 text-white rounded-full hover:bg-red-500 transition-colors text-xs shadow-md">踢</button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右側：主遊戲展示面板 */}
        <main className="flex-grow glass-panel rounded-3xl border border-yellow-500/30 bg-black/60 relative flex flex-col items-center justify-center p-6 lg:p-12 overflow-hidden shadow-2xl min-h-[500px]">
          
          {/* Waiting Phase */}
          {room?.status === 'waiting' && (
            <div className="flex flex-col items-center text-center max-w-md relative z-10 animate-fade-in">
              <div className="text-8xl mb-8">🎰</div>
              {isHost ? (
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl font-black text-yellow-400 drop-shadow-md">準備好開始豪賭了嗎？</h3>
                  <button 
                    className="mt-4 px-10 py-5 rounded-full font-black text-2xl transition-all uppercase tracking-wider bg-gradient-to-b from-yellow-400 to-amber-600 text-black hover:scale-105 hover:shadow-[0_0_40px_rgba(245,158,11,0.8)] shadow-xl"
                    onClick={handleStartRound}
                  >
                    🎲 開始生死骰子
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl font-black text-yellow-200">等待莊家開局...</h3>
                  <p className="text-yellow-400/70">請握緊你的籌碼。</p>
                </div>
              )}
            </div>
          )}

          {/* Betting Phase */}
          {(isBetting || isResult) && gameState && (
            <div className="flex flex-col items-center w-full max-w-3xl relative z-10">
              
              {/* 總獎池 */}
              <div className="mb-12 flex flex-col items-center animate-fade-in-up">
                <span className="text-yellow-500 font-bold tracking-widest uppercase mb-2">總獎金池 POT</span>
                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]">
                  ${gameState.pot}
                </div>
              </div>

              {/* 下注控制區 */}
              {isBetting && (
                <div className="w-full bg-black/50 p-6 rounded-3xl border border-yellow-500/20 shadow-inner text-center">
                  {!hasBet ? (
                    <>
                      <h3 className="text-xl font-bold text-yellow-100 mb-6">你要下注多少籌碼？</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {[50, 100, 500].map(amount => (
                          <button 
                            key={amount}
                            onClick={() => handlePlaceBet(amount)}
                            disabled={myCoins < amount}
                            className={`py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all border-2 
                              ${myCoins >= amount 
                                ? 'bg-yellow-900/40 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500 hover:text-black hover:scale-105' 
                                : 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed'}`}
                          >
                            ${amount}
                          </button>
                        ))}
                        <button 
                          onClick={() => handlePlaceBet(myCoins)}
                          disabled={myCoins <= 0}
                          className={`py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl transition-all border-2 
                            ${myCoins > 0 
                              ? 'bg-red-900/60 border-red-500 text-red-400 hover:bg-red-600 hover:text-white hover:scale-105 hover:shadow-[0_0_20px_rgba(239,68,68,0.8)]' 
                              : 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed'}`}
                        >
                          ALL IN
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-6">
                      <h3 className="text-2xl font-black text-yellow-400 animate-pulse">已下注，等待開獎...</h3>
                      <p className="text-gray-400 mt-2">你投入了 ${gameState.bets[myId]} 籌碼</p>
                    </div>
                  )}

                  {isHost && (
                    <div className="mt-8 pt-6 border-t border-yellow-500/20">
                      <button 
                        onClick={handleRollDice}
                        className="px-10 py-4 rounded-full font-black text-xl transition-all uppercase tracking-widest bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:scale-105 shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                      >
                        🔥 開骰！
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 結果展示區 */}
              {isResult && (
                <div className="w-full text-center animate-fade-in-up mt-8">
                  {gameState.winners.includes(myId) ? (
                    <div className="mb-8">
                      <h2 className="text-4xl md:text-5xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] mb-2">🎉 你贏了！🎉</h2>
                      <p className="text-xl text-yellow-100">獨得獎金 ${gameState.pot}</p>
                    </div>
                  ) : (
                    <div className="mb-8">
                      <h2 className="text-3xl md:text-4xl font-black text-gray-400">勝敗乃兵家常事</h2>
                      <p className="text-lg text-gray-500 mt-2">下次運氣會更好</p>
                    </div>
                  )}

                  {isHost && (
                    <button 
                      onClick={handleStartRound}
                      className="px-10 py-4 rounded-full font-black text-xl transition-all uppercase tracking-wider bg-yellow-500 hover:bg-yellow-400 text-black hover:scale-105 shadow-xl"
                    >
                      🎲 下一局
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 破產救濟金 */}
          {myCoins < 10 && room?.status === 'waiting' && (
            <div className="absolute bottom-10 animate-bounce">
              <button 
                onClick={handleClaimRelief}
                className="px-8 py-3 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-full shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400 transition-all"
              >
                💸 領取破產救濟金 ($1000)
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
