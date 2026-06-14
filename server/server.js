const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { Room, Round, User, Chat, createRoomInstance, createRoundInstance, createUserInstance, createChatInstance, createId, getIsInMemory } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// 簡單的 HTTP 測試路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Google 登入紀錄 API
app.post('/api/auth/google', async (req, res) => {
  try {
    const { id, name, email, picture } = req.body;
    if (!id || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let user = await User.findOne({ googleId: id });
    if (user) {
      user.lastLoginAt = new Date();
      user.name = name;
      user.picture = picture;
      await user.save();
    } else {
      user = createUserInstance({
        googleId: id,
        name,
        email,
        picture
      });
      await user.save();
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("Auth API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
// 訪客登入 API
app.post('/api/auth/guest', async (req, res) => {
  try {
    const { name, guestId } = req.body;
    if (!name || !guestId) return res.status(400).json({ error: 'Missing fields' });

    let user = await db.User.findOne({ googleId: guestId });
    if (user) {
      if (user.isBanned) return res.status(403).json({ error: '此帳號已被封鎖' });
      user.lastLoginAt = new Date();
      user.name = name;
      await user.save();
    } else {
      user = db.createUserInstance({
        googleId: guestId,
        name,
        email: `guest_${guestId}@partyhub.local`,
        picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + guestId
      });
      await user.save();
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("Guest Auth Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 管理員後台：獲取所有用戶名單 API
app.get('/api/admin/users', async (req, res) => {
  try {
    let users = [];
    if (typeof db.User.find === 'function') {
      const result = await db.User.find();
      users = Array.isArray(result) ? [...result] : result;
      users.sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt));
    }
    res.json(users);
  } catch (error) {
    console.error("Admin Users API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 手動新增用戶 API
app.post('/api/admin/users', async (req, res) => {
  try {
    const { name, email, picture } = req.body;
    const user = db.createUserInstance({
      googleId: 'manual_' + Date.now(),
      name: name || '新用戶',
      email: email || 'manual@partyhub.local',
      picture: picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + Date.now()
    });
    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 手動刪除用戶 API
app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await db.User.deleteOne({ _id: userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 變更用戶狀態 (禁言/封鎖) API
app.post('/api/admin/users/:userId/action', async (req, res) => {
  try {
    const { userId } = req.params;
    const { action } = req.body; // 'mute', 'unmute', 'ban', 'unban'
    
    // 注意：MongoDB 的 _id 查詢要麼直接傳 string，要麼傳 ObjectId。如果用 mockDB 則是 string。
    const users = await db.User.find();
    const user = users.find(u => u._id.toString() === userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (action === 'mute') user.isMuted = true;
    if (action === 'unmute') user.isMuted = false;
    if (action === 'ban') user.isBanned = true;
    if (action === 'unban') user.isBanned = false;

    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 獲取所有活躍房間 API
app.get('/api/admin/rooms', async (req, res) => {
  try {
    let rooms = [];
    if (typeof Room.find === 'function') {
      const result = await Room.find();
      rooms = Array.isArray(result) ? [...result] : result;
      rooms.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    res.json(rooms);
  } catch (error) {
    console.error("Admin Rooms API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 強制解散房間 API
app.delete('/api/admin/rooms/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    await Room.deleteOne({ roomCode: roomCode.toUpperCase() });
    // 通知該房間所有人強制退出
    io.to(roomCode.toUpperCase()).emit('forceClose', { message: '本房間已被管理員強制解散。' });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete Room API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 全服廣播 API
app.post('/api/admin/broadcast', (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    // 向全服廣播
    io.emit('systemBroadcast', { message });
    res.json({ success: true });
  } catch (error) {
    console.error("Broadcast API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 玩家管理操作 API (踢除/加錢)
app.post('/api/admin/rooms/:roomCode/players/:playerId/action', async (req, res) => {
  try {
    const { roomCode, playerId } = req.params;
    const { action, payload } = req.body;
    
    const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    const playerIndex = room.players.findIndex(p => p._id.toString() === playerId);
    if (playerIndex === -1) return res.status(404).json({ error: 'Player not found' });
    
    const player = room.players[playerIndex];

    if (action === 'kick') {
      const targetSocketId = player.socketId;
      room.players.splice(playerIndex, 1);
      await room.save();
      io.to(room.roomCode).emit('roomUpdated', room);
      io.to(targetSocketId).emit('kickedOut');
    } else if (action === 'add_coins') {
      const amount = payload?.amount || 1000;
      player.coins += amount;
      await room.save();
      io.to(room.roomCode).emit('roomUpdated', room);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json({ success: true, room });
  } catch (error) {
    console.error("Player Action API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 獲取大廳狀態與富豪排行榜 API
app.get('/api/lobby/status', async (req, res) => {
  try {
    let rooms = [];
    if (typeof Room.find === 'function') {
      const result = await Room.find();
      rooms = Array.isArray(result) ? [...result] : result;
    }
    
    const activeRoomsCount = rooms.length;
    let activePlayersCount = 0;
    let allActivePlayers = [];
    
    rooms.forEach(room => {
      activePlayersCount += room.players.length;
      room.players.forEach(p => {
        allActivePlayers.push({ 
          nickname: p.nickname, 
          coins: p.coins || 0, 
          roomCode: room.roomCode 
        });
      });
    });
    
    // 依金幣排序，取前 5 名富豪
    allActivePlayers.sort((a, b) => b.coins - a.coins);
    const leaderboard = allActivePlayers.slice(0, 5);
    
    res.json({ activeRoomsCount, activePlayersCount, leaderboard });
  } catch (error) {
    console.error("Lobby Status API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 獲取大廳聊天歷史紀錄 API
app.get('/api/lobby/chat', async (req, res) => {
  try {
    let chats = [];
    if (typeof db.Chat.find === 'function') {
      chats = await db.Chat.find().sort({ time: -1 }).limit(50);
      chats = chats.reverse(); // 讓舊的在前面，新的在後面
    }
    res.json(chats);
  } catch (error) {
    console.error("Lobby Chat API Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 管理員刪除大廳聊天紀錄
app.delete('/api/admin/chat/:chatId', async (req, res) => {
  try {
    await db.Chat.deleteOne({ _id: req.params.chatId });
    // 通知所有人更新聊天
    io.emit('chatDeleted', req.params.chatId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 發送揪團邀請至大廳 API
app.post('/api/lobby/invite', async (req, res) => {
  try {
    const { userId, user, roomCode, gameType } = req.body;
    
    // 檢查禁言與封鎖
    if (userId) {
      const users = await db.User.find();
      const dbUser = users.find(u => u.googleId === userId || u._id.toString() === userId);
      if (dbUser && dbUser.isBanned) return res.status(403).json({ error: '您已被封鎖。' });
      if (dbUser && dbUser.isMuted) return res.status(403).json({ error: '您已被禁言。' });
    }

    const gameNames = {
      'truth-or-dare': '真心話大冒險',
      'spy': '誰是臥底',
      'turtle-soup': '海龜湯',
      'casino': '皇家賭場'
    };

    const chatMsg = {
      user: user || '匿名玩家',
      message: `我建立了一個【${gameNames[gameType] || gameType}】房間，快來加入！`,
      type: 'invite',
      payload: { roomCode, gameType },
      time: new Date()
    };
    
    const newChat = db.createChatInstance(chatMsg);
    await newChat.save();
    chatMsg._id = newChat._id.toString();

    io.emit('lobbyMessage', chatMsg);
    res.json({ success: true });
  } catch (error) {
    console.error("Invite Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
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

let TURTLE_WORDS = [];
try {
  TURTLE_WORDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'turtleWords.json'), 'utf-8'));
  console.log(`✅ 成功載入海龜湯題庫: ${TURTLE_WORDS.length} 題`);
} catch (error) {
  TURTLE_WORDS = [{ title: "預設海龜湯", surface: "預設湯面", bottom: "預設湯底" }];
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
  // 大廳全服聊天室 (Lobby Chat)
  // ==========================================
  socket.on('sendLobbyMessage', async (data) => {
    // 檢查禁言與封鎖
    if (data.userId) {
      const users = await db.User.find();
      const user = users.find(u => u.googleId === data.userId || u._id.toString() === data.userId);
      if (user && user.isBanned) return socket.emit('error', { message: '您已被封鎖，無法發言。' });
      if (user && user.isMuted) return socket.emit('error', { message: '您已被禁言。' });
    }

    const chatMsg = {
      user: data.user,
      message: data.message,
      type: data.type || 'text',
      payload: data.payload || null,
      time: new Date()
    };
    
    // 儲存到資料庫
    try {
      const newChat = db.createChatInstance(chatMsg);
      await newChat.save();
      
      // 將 _id 賦值給廣播物件，讓前端可以識別並讓管理員刪除
      chatMsg._id = newChat._id.toString();
    } catch(e) {
      console.error("儲存聊天訊息失敗:", e);
    }

    // 廣播給所有人
    io.emit('lobbyMessage', chatMsg);
  });

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
        coins: 1000,
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

      // 檢查暱稱是否重複，如果重複則視為重新連線接管該角色
      const existingPlayer = room.players.find(p => p.nickname === nickname);
      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        if (existingPlayer.status === 'offline' || existingPlayer.status === 'kicked') {
          existingPlayer.status = 'idle';
        }
        await room.save();
        socket.join(code);
        socket.emit('joinSuccess', { playerId: existingPlayer._id, isHost: existingPlayer.isHost, roomCode: code });
        io.to(code).emit('roomUpdated', room);
        return;
      }

      const playerId = createId();
      const newPlayer = {
        _id: playerId,
        socketId: socket.id,
        nickname,
        score: 0,
        points: 100,
        coins: 1000,
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
  socket.on('spinWheel', async ({ roomCode, targetId }) => {
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

      let selected;
      if (targetId) {
        selected = room.players.find(p => p._id === targetId);
        if (!selected) return socket.emit('error', { message: '指定的玩家不存在！' });
      } else {
        let availablePlayers = room.players;
        if (room.players.length > 1 && state.lastSelectedId) {
          const others = room.players.filter(p => p._id !== state.lastSelectedId);
          if (others.length > 0) availablePlayers = others;
        }
        
        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        selected = availablePlayers[randomIndex];
      }
      
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
  // 9. 海龜湯 (Turtle Soup) 專屬邏輯
  // ==========================================
  socket.on('startTurtleGame', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'turtle_soup') return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;

      const puzzle = TURTLE_WORDS[Math.floor(Math.random() * TURTLE_WORDS.length)];

      room.status = 'turtle_playing';
      room.turtleGameState = {
        title: puzzle.title,
        surface: puzzle.surface,
        bottom: puzzle.bottom,
        isRevealed: false
      };
      
      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('revealTurtleAnswer', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'turtle_soup') return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;

      if (room.turtleGameState) {
        room.status = 'turtle_revealed';
        room.turtleGameState.isRevealed = true;
        await room.save();
        io.to(roomCode).emit('roomUpdated', room);
        io.to(roomCode).emit('turtleAnswerRevealed');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // ==========================================
  // 10. 皇家賭場：生死骰子 (Casino) 專屬邏輯
  // ==========================================
  socket.on('startCasinoRound', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'casino') return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;

      room.status = 'casino_betting';
      room.casinoGameState = {
        phase: 'betting',
        pot: 0,
        bets: {},
        rolls: {},
        winners: []
      };
      
      // 所有玩家重置狀態
      room.players.forEach(p => p.status = 'waiting');

      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('placeBet', async ({ roomCode, amount }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'casino' || room.status !== 'casino_betting') return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.coins < amount || amount <= 0) return;

      // 扣除金幣並加入獎池
      player.coins -= amount;
      room.casinoGameState.pot += amount;
      room.casinoGameState.bets[player._id.toString()] = amount;
      player.status = 'idle'; // 已下注

      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('rollCasinoDice', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.gameType !== 'casino' || room.status !== 'casino_betting') return;
      const host = room.players.find(p => p.socketId === socket.id);
      if (!host || !host.isHost) return;

      room.status = 'casino_result';
      room.casinoGameState.phase = 'result';

      let maxRoll = -1;
      let winners = [];

      // 幫所有有下注的玩家擲骰子
      Object.keys(room.casinoGameState.bets).forEach(playerId => {
        const roll = Math.floor(Math.random() * 100) + 1; // 1-100
        room.casinoGameState.rolls[playerId] = roll;

        if (roll > maxRoll) {
          maxRoll = roll;
          winners = [playerId];
        } else if (roll === maxRoll) {
          winners.push(playerId);
        }
      });

      room.casinoGameState.winners = winners;

      // 分配獎金
      if (winners.length > 0) {
        const winAmount = Math.floor(room.casinoGameState.pot / winners.length);
        winners.forEach(wId => {
          const w = room.players.find(p => p._id.toString() === wId);
          if (w) w.coins += winAmount;
        });
      }

      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
      io.to(roomCode).emit('casinoDiceRolled');
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('claimReliefFund', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.coins >= 500) return; // 破產才能領

      player.coins += 1000;
      await room.save();
      io.to(roomCode).emit('roomUpdated', room);
    } catch (err) {
      console.error(err);
    }
  });

  // ==========================================
  // 11. 用戶斷線處理
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
