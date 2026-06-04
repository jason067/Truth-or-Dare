import React from 'react';
import './TruthOrDareCard.css';

export default function TruthOrDareCard({
  isMyTurn = false,
  selectedPlayerName = "",
  points = 100,
  choice = null,
  promptText = "",
  loading = false,
  isFlipped = false,
  onSelectChoice,
  onComplete,
  onSkip
}) {
  return (
    <div className="w-full max-w-[440px] mx-auto p-6 rounded-3xl glass-panel relative z-10 text-white">
      {/* 頂部玩家狀態區 */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-lg font-bold tracking-wide">
          {isMyTurn ? (
            <span className="text-truth-cyan glow-text">🎯 輪到你了！</span>
          ) : (
            <span>正在看 <strong className="text-dare-pink">{selectedPlayerName}</strong> 挑戰...</span>
          )}
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-semibold border border-white/20 flex items-center gap-2">
          🪙 <span className="text-yellow-400 drop-shadow-md">{points} 點</span>
        </div>
      </div>

      {/* 3D 翻轉卡片主體 */}
      <div className="w-full h-[420px] perspective-[1500px]">
        <div className={`relative w-full h-full transition-transform duration-1000 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* ===================== 卡片正面 (選擇階段) ===================== */}
          <div className="absolute top-0 left-0 w-full h-full backface-hidden rounded-3xl border-2 border-white/10 bg-gradient-to-br from-indigo-950 to-fuchsia-950 shadow-2xl flex flex-col p-8 items-center text-center">
            
            <h2 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-dare-pink to-truth-cyan mt-6 mb-2 drop-shadow-lg">
              CHOOSE YOUR FATE
            </h2>
            <p className="text-sm text-indigo-200 mb-10 leading-relaxed font-medium">
              {isMyTurn ? "請選擇你的命運，面對內心或挑戰極限" : "等待對方糾結中..."}
            </p>

            {isMyTurn && !loading && (
              <div className="flex flex-col w-full gap-4 mt-auto mb-6">
                <button 
                  className="relative group w-full py-4 rounded-xl text-lg font-extrabold text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(0,240,255,0.6)] transition-all overflow-hidden"
                  onClick={() => onSelectChoice && onSelectChoice('truth')}
                >
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    <span className="text-2xl">👁️‍🗨️</span> 真心話
                  </span>
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12"></div>
                </button>

                <button 
                  className="relative group w-full py-4 rounded-xl text-lg font-extrabold text-white bg-gradient-to-r from-rose-500 to-pink-700 shadow-[0_0_20px_rgba(255,0,127,0.4)] hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(255,0,127,0.6)] transition-all overflow-hidden"
                  onClick={() => onSelectChoice && onSelectChoice('dare')}
                >
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    <span className="text-2xl">⚡</span> 大冒險
                  </span>
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12"></div>
                </button>
              </div>
            )}

            {(!isMyTurn || loading) && (
              <div className="flex flex-col items-center gap-4 mt-auto mb-10 text-indigo-300">
                <div className="w-12 h-12 rounded-full border-4 border-t-truth-cyan border-r-dare-pink border-b-truth-cyan border-l-dare-pink animate-spin shadow-[0_0_20px_rgba(255,0,127,0.5)]"></div>
                <span className="font-semibold tracking-wider animate-pulse">{loading ? "正在為你嚴選題目..." : "命運抉擇中..."}</span>
              </div>
            )}
          </div>

          {/* ===================== 卡片背面 (題目揭曉) ===================== */}
          {/* FIX: MUST contain rotate-y-180 and backface-hidden globally so it faces backward before flip */}
          <div className={`absolute top-0 left-0 w-full h-full backface-hidden rotate-y-180 rounded-3xl border-2 shadow-2xl flex flex-col p-8 text-center transition-colors duration-500 
            ${choice === 'truth' ? 'border-truth-cyan/50 bg-gradient-to-br from-slate-900 to-cyan-950 shadow-[inset_0_0_40px_rgba(0,240,255,0.2)]' : ''}
            ${choice === 'dare' ? 'border-dare-pink/50 bg-gradient-to-br from-slate-900 to-rose-950 shadow-[inset_0_0_40px_rgba(255,0,127,0.2)]' : ''}
            ${!choice ? 'border-white/10 bg-gray-900' : ''}
          `}>
            
            <div className="mx-auto inline-block py-1.5 px-6 rounded-full text-xs font-black tracking-widest bg-black/40 border border-white/20 mb-6">
              {choice === 'truth' ? (
                <span className="text-truth-cyan glow-text uppercase">Truth · 真心話</span>
              ) : choice === 'dare' ? (
                <span className="text-dare-pink glow-text uppercase">Dare · 大冒險</span>
              ) : (
                <span className="text-gray-400">WAITING</span>
              )}
            </div>
            
            <div className="flex-grow flex items-center justify-center py-4">
              <p className="text-2xl font-bold leading-relaxed text-slate-100 drop-shadow-md">
                {promptText ? `「 ${promptText} 」` : "..."}
              </p>
            </div>

            {/* 底部操作面板 */}
            {isMyTurn && (
              <div className="flex gap-4 mt-6 w-full">
                <button 
                  className="flex-1 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold hover:bg-emerald-400 hover:-translate-y-1 hover:shadow-lg transition-all"
                  onClick={onComplete}
                >
                  🎉 我完成了
                </button>
                <button 
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white border border-white/20 font-bold hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-1 transition-all"
                  onClick={onSkip} 
                  disabled={points < 20}
                  title={points < 20 ? "點數不足 (-20 🪙)" : "更換題目 (-20 🪙)"}
                >
                  🔄 換一題 (-20 🪙)
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
