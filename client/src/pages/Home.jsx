import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  const games = [
    {
      id: 'truth-or-dare',
      title: '真心話大冒險',
      description: '最經典的派對遊戲，看誰先不敢玩！',
      icon: '🃏',
      color: 'from-pink-500 via-purple-500 to-cyan-500',
      active: true
    },
    {
      id: 'spy',
      title: '誰是臥底',
      description: '隱藏在人群中，你能找出那個與眾不同的人嗎？',
      icon: '🕵️',
      color: 'from-gray-700 to-gray-900',
      active: false
    },
    {
      id: 'turtle-soup',
      title: '海龜湯',
      description: '用最刁鑽的問題，還原離奇的真相。',
      icon: '🐢',
      color: 'from-green-700 to-emerald-900',
      active: false
    },
    {
      id: 'avalon',
      title: '阿瓦隆',
      description: '正義與邪惡的對決，你該相信誰？',
      icon: '🗡️',
      color: 'from-red-800 to-yellow-700',
      active: false
    }
  ];

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <header className="mb-12 text-center relative z-10 pt-10">
        <h1 className="text-5xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-2xl mb-4 glow-text">
          PARTY HUB
        </h1>
        <p className="text-xl text-gray-300 font-bold tracking-widest">終極派對遊戲大廳</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-7xl mx-auto relative z-10 w-full">
        {games.map(game => (
          <div 
            key={game.id}
            onClick={() => game.active && navigate(`/${game.id}`)}
            className={`
              relative overflow-hidden rounded-[2rem] p-8 flex flex-col items-center text-center transition-all duration-300
              ${game.active ? 'cursor-pointer hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] glass-panel border border-white/20' : 'opacity-60 grayscale cursor-not-allowed border border-white/5 bg-white/5'}
            `}
          >
            {/* Background gradient for active games */}
            {game.active && (
              <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-10`}></div>
            )}
            
            <div className="text-6xl mb-6 relative z-10 drop-shadow-lg">{game.icon}</div>
            <h2 className="text-2xl font-black text-white mb-4 relative z-10 tracking-wider">{game.title}</h2>
            <p className="text-gray-400 text-sm font-medium relative z-10 leading-relaxed">{game.description}</p>
            
            {!game.active && (
              <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs font-bold text-gray-300 border border-white/10">
                即將推出
              </div>
            )}
            {game.active && (
              <button className="mt-8 px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all uppercase tracking-widest w-full">
                開始遊戲
              </button>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
