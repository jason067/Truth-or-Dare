const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { Room, Round, createRoomInstance, createRoundInstance, createId } = require('./db');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 簡單的 HTTP 測試路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // 在開發環境允許任何來源連線
    methods: ['GET', 'POST']
  }
});

const fs = require('fs');
const path = require('path');

// 載入 1000 題題庫 (從 generateQuestions.js 生成的 questions.json 讀取)
let TRUTH_QUESTIONS = [];
let DARE_CHALLENGES = [];
try {
  const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf-8'));
  TRUTH_QUESTIONS = questionsData.truth;
  DARE_CHALLENGES = questionsData.dare;
  console.log(`✅ 成功載入題庫: Truth ${TRUTH_QUESTIONS.length} 題, Dare ${DARE_CHALLENGES.length} 題`);
} catch (error) {
  console.error("⚠️ 無法讀取 questions.json，請確認檔案存在。使用預設題庫。");
  TRUTH_QUESTIONS = ["分享一個你從未告訴過任何人的尷尬秘密。", "你最崇拜在座的哪一位？為什麼？"];
  DARE_CHALLENGES = ["用最浮誇的語氣對著牆壁告白一分鐘。", "模仿一隻喝醉的猩猩，維持 30 秒。"];
}

let SPY_WORDS = [];
try {
  SPY_WORDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'spyWords.json'), 'utf-8'));
  console.log(`✅ 成功載入臥底題庫: ${SPY_WORDS.length} 組`);
} catch (error) {
  SPY_WORDS = [["麥克風", "擴音器"], ["蘋果", "水蜜桃"]];
}

const roomState = new Map(); // 用來記錄每個房間出過的題目與上次抽到的人

// 隨機獲取不重複的題目
function getRandomQuestion(roomCode, type) {
  const list = type === 'truth' ? TRUTH_QUESTIONS : DARE_CHALLENGES;
  
  if (!roomState.has(roomCode)) {
    roomState.set(roomCode, { usedTruths: [], usedDares: [], lastSelectedId: null });
  }
  const state = roomState.get(roomCode);
  const usedList = type === 'truth' ? state.usedTruths : state.usedDares;

  // 過濾出還沒出過的題目
  let available = list.filter(q => !usedList.includes(q));
  
  // 如果題庫抽完了，就清空紀錄重新來過
  if (available.length === 0) {
    usedList.length = 0;
    available = list;
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  const picked = available[randomIndex];
  usedList.push(picked);
  return picked;
}

// 產生隨機房間代碼
function generateRoomCode() {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

io.on('connection', (socket) => {
  console.log(`用戶連線: ${socket.id}`);

  // ==========================================
  // 1. 創建房間 (createRoom)
  // ==========================================
  socket.on('createRoom', async ({ nickname, gameType }) => {
    try {
      let roomCode = generateRoomCode();
      // 確保 roomCode 唯一
      let existing = await Room.findOne({ roomCode });
      while (existing) {
        roomCode = generateRoomCode();
        existing = await Room.findOne({ roomCode });
      }

      const playerId = createId();
      const hostPlayer = {
        _id: playerId,
        socketId: socket.id,
        nickname,
        score: 0,
        points: 100,
        isHost: true,
        status: 'idle'
      };

      const room = createRoomInstance({
        roomCode,
        gameType: gameType || 'truth_or_dare',
        status: 'waiting',
        players: [hostPlayer],
        currentRoundNumber: 0
      });

      await room.save();
      socket.join(roomCode);

      socket.emit('joinSuccess', { playerId, isHost: true, roomCode });
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: '創建房間失敗' });
    }
  });

  // ==========================================
  // 2. 加入房間 (joinRoom)
  // ==========================================
  socket.on('joinRoom', async ({ roomCode, nickname }) => {
    try {
      const code = roomCode.toUpperCase();
      let room = await Room.findOne({ roomCode: code });
      if (!room) {
        return socket.emit('error', { message: '找不到該房間！' });
      }

      if (room.status === 'playing') {
        // 如果遊戲已開始，通常不允許中途加入，但為了派對體驗，可以改為作為觀察者加入
        // 這裡設定為直接拒絕加入
        return socket.emit('error', { message: '遊戲已經開始，無法加入！' });
      }

      // 檢查暱稱是否重複
      const isNameTaken = room.players.some(p => p.nickname === nickname && p.status !== 'offline');
      if (isNameTaken) {
        return socket.emit('error', { message: '此暱稱已在房間中，請換一個暱稱！' });
      }

      const playerId = createId();
      const newPlayer = {
        _id: playerId,
        socketId: socket.id,
        nickname,
        score: 0,
        points: 100,
        isHost: false,
        status: 'idle'
      };

      room.players.push(newPlayer);
      await room.save();

      socket.join(code);
      socket.emit('joinSuccess', { playerId, isHost: false, roomCode: code });
      io.to(code).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: '加入房間時發生錯誤' });
    }
  });

  // ==========================================
  // 3. 開始轉輪盤 (spinWheel)
  // ==========================================
  socket.on('spinWheel', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return socket.emit('error', { message: '找不到房間' });

      // 檢查權限：只有房主可以轉輪盤
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) {
        return socket.emit('error', { message: '只有房主可以發起轉輪盤！' });
      }

      if (room.players.length < 2) {
        return socket.emit('error', { message: '房間內人數不足，需要至少 2 人！' });
      }

      // 重置所有玩家的狀態為 idle
      room.players.forEach(p => {
        p.status = 'idle';
      });

      // 取得房間狀態
      if (!roomState.has(roomCode)) {
        roomState.set(roomCode, { usedTruths: [], usedDares: [], lastSelectedId: null });
      }
      const state = roomState.get(roomCode);

      // 隨機挑選玩家：如果房間人數 > 1，排除上一局剛被抽到的人，避免連續當選
      let availablePlayers = room.players;
      if (room.players.length > 1 && state.lastSelectedId) {
        const others = room.players.filter(p => p._id !== state.lastSelectedId);
        if (others.length > 0) availablePlayers = others;
      }
      
      const randomIndex = Math.floor(Math.random() * availablePlayers.length);
      const selected = availablePlayers[randomIndex];
      
      // 更新最後抽中紀錄
      state.lastSelectedId = selected._id;
      selected.status = 'selected';

      room.currentRoundNumber += 1;
      room.status = 'playing';
      await room.save();

      // 建立 Round 資料庫紀錄
      const round = createRoundInstance({
        roomCode,
        roundNumber: room.currentRoundNumber,
        selectedPlayerId: selected._id,
        selectedPlayerName: selected.nickname,
        choice: null,
        questionPrompt: ''
      });
      await round.save();

      // 廣播給房間所有人輪盤轉動結果
      io.to(roomCode).emit('wheelSpun', {
        selectedPlayerId: selected._id,
        selectedPlayerName: selected.nickname,
        currentRoundNumber: room.currentRoundNumber,
        room
      });
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: '啟動輪盤失敗' });
    }
  });

  // ==========================================
  // 4. 玩家選擇真心話或大冒險 (selectChoice)
  // ==========================================
  socket.on('selectChoice', async ({ roomCode, choice }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return socket.emit('error', { message: '找不到房間' });

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.status !== 'selected') {
        return socket.emit('error', { message: '現在還沒有輪到你選擇！' });
      }

      player.status = 'answering';
      await room.save();

      // 生成題目 (隨機選取，避免重複)
      const prompt = getRandomQuestion(roomCode, choice);

      // 更新 Round 紀錄
      await Round.findOneAndUpdate(
        { roomCode, roundNumber: room.currentRoundNumber },
        { choice, questionPrompt: prompt }
      );

      // 廣播給房內所有人
      io.to(roomCode).emit('choiceSelected', {
        selectedPlayerId: player._id,
        selectedPlayerName: player.nickname,
        choice,
        questionPrompt: prompt,
        room
      });
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: '選擇失敗' });
    }
  });

  // ==========================================
  // 5. 換一題 (skipPrompt - 扣減點數並重新生成)
  // ==========================================
  socket.on('skipPrompt', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return socket.emit('error', { message: '找不到房間' });

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.status !== 'answering') {
        return socket.emit('error', { message: '無法更換題目！' });
      }

      if (player.points < 20) {
        return socket.emit('error', { message: '點數不足，更換題目需要 20 點！' });
      }

      // 扣除點數
      player.points -= 20;
      await room.save();

      // 查詢目前的 Round 紀錄來獲取其選擇類型（truth/dare）
      const round = await Round.findOne({ roomCode, roundNumber: room.currentRoundNumber });
      if (!round) return socket.emit('error', { message: '找不到回合紀錄' });

      const newPrompt = getRandomQuestion(roomCode, round.choice);
      
      round.questionPrompt = newPrompt;
      round.isSkipped = true;
      await round.save();

      // 廣播更換題目的事件
      io.to(roomCode).emit('promptRerolled', {
        selectedPlayerId: player._id,
        questionPrompt: newPrompt,
        room
      });
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: '更換題目失敗' });
    }
  });

  // ==========================================
  // 6. 我完成了 (completeRound - 獲得積分並重置狀態)
  // ==========================================
  socket.on('completeRound', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return socket.emit('error', { message: '找不到房間' });

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.status !== 'answering') {
        return socket.emit('error', { message: '操作無效！' });
      }

      // 增加分數
      player.score += 10;
      // 重置所有玩家狀態為 idle，等待下一輪
      room.players.forEach(p => {
        p.status = 'idle';
      });
      room.status = 'waiting'; // 房間狀態回到等待轉輪盤狀態
      await room.save();

      // 更新回合為完成
      await Round.findOneAndUpdate(
        { roomCode, roundNumber: room.currentRoundNumber },
        { isCompleted: true }
      );

      io.to(roomCode).emit('roundCompleted', {
        playerId: player._id,
        nickname: player.nickname,
        room
      });
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: '完成回合失敗' });
    }
  });

  // ==========================================
  // 7. 踢人與抗議機制 (Kick & Appeal)
  // ==========================================
  
  socket.on('kickPlayer', async ({ roomCode, targetId }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return socket.emit('error', { message: '只有房主可以踢人' });

      const target = room.players.find(p => p._id === targetId);
      if (!target || target.isHost) return socket.emit('error', { message: '無法踢出此玩家' });

      target.status = 'kicked';
      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('appealKick', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.status !== 'kicked') return;

      player.status = 'appealing';
      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('resolveAppeal', async ({ roomCode, targetId, accept }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;

      const targetIndex = room.players.findIndex(p => p._id === targetId);
      if (targetIndex === -1) return;
      const target = room.players[targetIndex];

      if (accept) {
        target.status = 'idle';
        await room.save();
        io.to(roomCode).emit('roomUpdated', room);
      } else {
        const targetSocketId = target.socketId;
        room.players.splice(targetIndex, 1);
        await room.save();
        io.to(roomCode).emit('roomUpdated', room);
        io.to(targetSocketId).emit('kickedOut');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // ==========================================
  // 8. 誰是臥底 (Spy) 專屬邏輯
  // ==========================================
  socket.on('startSpyGame', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'spy') return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;
      if (room.players.length < 3) return socket.emit('error', { message: '人數不足，誰是臥底至少需要 3 人！' });

      const wordPair = SPY_WORDS[Math.floor(Math.random() * SPY_WORDS.length)];
      const commonWord = wordPair[0];
      const spyWord = wordPair[1];

      const spyIndex = Math.floor(Math.random() * room.players.length);
      const spyId = room.players[spyIndex]._id;

      room.spyGameState = {
        spyId,
        commonWord,
        spyWord,
        alivePlayers: room.players.map(p => p._id),
        votes: {}
      };
      
      room.players.forEach(p => p.status = 'playing_spy');
      room.status = 'playing';
      await room.save();

      room.players.forEach(p => {
        const role = p._id === spyId ? 'spy' : 'commoner';
        const word = role === 'spy' ? spyWord : commonWord;
        io.to(p.socketId).emit('spyGameStarted', { role, word });
      });

      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('startSpyVoting', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'spy') return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;

      room.status = 'spy_voting';
      room.spyGameState.votes = {};
      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('submitSpyVote', async ({ roomCode, votedPlayerId }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.status !== 'spy_voting') return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !room.spyGameState.alivePlayers.includes(player._id)) return;

      room.spyGameState.votes[player._id] = votedPlayerId;
      await room.save();
      
      io.to(roomCode).emit('roomUpdated', room);

      const aliveCount = room.spyGameState.alivePlayers.length;
      const votesCount = Object.keys(room.spyGameState.votes).length;

      if (votesCount === aliveCount) {
        const voteCounts = {};
        for (const voter in room.spyGameState.votes) {
          const voted = room.spyGameState.votes[voter];
          voteCounts[voted] = (voteCounts[voted] || 0) + 1;
        }
        
        let maxVotes = 0;
        let eliminatedId = null;
        let tie = false;

        for (const [vid, count] of Object.entries(voteCounts)) {
          if (count > maxVotes) {
            maxVotes = count;
            eliminatedId = vid;
            tie = false;
          } else if (count === maxVotes) {
            tie = true;
          }
        }

        let winner = null;
        let isSpyEliminated = false;

        if (!tie) {
          if (eliminatedId === room.spyGameState.spyId) {
            isSpyEliminated = true;
            winner = 'commoner';
          } else {
            winner = 'spy';
          }
        }

        room.status = 'spy_result';
        room.spyGameState.eliminatedId = eliminatedId;
        room.spyGameState.isSpyEliminated = isSpyEliminated;
        room.spyGameState.winner = winner;
        room.spyGameState.tie = tie;

        await room.save();
        io.to(roomCode).emit('spyVotingResult', room);
        io.to(roomCode).emit('roomUpdated', room);
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('restartSpyGame', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'spy') return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;

      room.status = 'waiting';
      room.spyGameState = null;
      room.players.forEach(p => p.status = 'idle');
      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  // ==========================================
  // 9. 用戶斷線處理
  // ==========================================
  socket.on('disconnect', async () => {
    try {
      const room = await Room.findOne({ 'players.socketId': socket.id });
      if (room) {
        const leavingPlayer = room.players.find(p => p.socketId === socket.id);
        console.log(`玩家 ${leavingPlayer?.nickname} 離開房間 ${room.roomCode}`);
        
        // 從玩家清單中移除
        room.players = room.players.filter(p => p.socketId !== socket.id);

        if (room.players.length === 0) {
          // 沒有人則直接刪除房間
          await Room.deleteOne({ roomCode: room.roomCode });
          roomState.delete(room.roomCode); // 清除記憶體中的房間題庫紀錄
          console.log(`房間 ${room.roomCode} 已無人，自動關閉。`);
        } else {
          // 重新指派房主
          const hasHost = room.players.some(p => p.isHost);
          if (!hasHost && room.players.length > 0) {
            room.players[0].isHost = true;
          }
          // 如果當前正在回答的玩家離開了，將房間狀態重置回 waiting
          if (leavingPlayer && (leavingPlayer.status === 'selected' || leavingPlayer.status === 'choosing' || leavingPlayer.status === 'answering')) {
            room.players.forEach(p => p.status = 'idle');
            room.status = 'waiting';
          }
          await room.save();
          io.to(room.roomCode).emit('roomUpdated', room);
        }
      }
    } catch (err) {
      console.error('斷線處理時出錯', err);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 後端伺服器運行在 http://localhost:${PORT}`);
});
