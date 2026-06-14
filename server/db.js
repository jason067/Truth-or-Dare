const mongoose = require('mongoose');
const { Schema } = mongoose;

// 1. 定義 Mongoose Schemas
const UserSchema = new Schema({
  googleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  picture: { type: String },
  lastLoginAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const ChatSchema = new Schema({
  user: { type: String, required: true },
  message: { type: String, required: true },
  time: { type: Date, default: Date.now }
});


const PlayerSchema = new Schema({
  socketId: { type: String, required: true },
  nickname: { type: String, required: true },
  score: { type: Number, default: 0 },
  points: { type: Number, default: 100 },
  isHost: { type: Boolean, default: false },
  status: { type: String, default: 'waiting' }, // 'waiting', 'idle', 'selected', 'choosing', 'answering', 'offline', 'kicked', 'appealing'
  coins: { type: Number, default: 1000 }
}, { _id: true });

const RoomSchema = new Schema({
  roomCode: { type: String, required: true, unique: true, uppercase: true },
  gameType: { type: String, default: 'truth_or_dare' },
  status: { type: String, default: 'waiting' }, // 'waiting', 'playing', 'finished', 'spy_voting', 'spy_result', 'turtle_playing', 'turtle_revealed', 'casino_betting', 'casino_result'
  players: [PlayerSchema],
  currentRoundNumber: { type: Number, default: 0 },
  spyGameState: { type: Object, default: null },
  turtleGameState: { type: Object, default: null },
  casinoGameState: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // 24小時後過期
});

const RoundSchema = new Schema({
  roomCode: { type: String, required: true },
  roundNumber: { type: Number, required: true },
  selectedPlayerId: { type: Schema.Types.ObjectId, required: true },
  selectedPlayerName: { type: String, required: true },
  choice: { type: String, default: null }, // 'truth', 'dare', null
  questionPrompt: { type: String, default: '' },
  isCompleted: { type: Boolean, default: false },
  isSkipped: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

// 2. 建立內存 Mock 數據庫防崩潰備用方案 (當本地沒有 MongoDB 時自動使用)
const memoryDb = {
  rooms: [],
  rounds: [],
  users: [],
  chats: [],
  
  createId() {
    return new mongoose.Types.ObjectId().toString();
  }
};

class InMemoryRoom {
  constructor(data) {
    this._id = memoryDb.createId();
    this.roomCode = data.roomCode ? data.roomCode.toUpperCase() : '';
    this.gameType = data.gameType || 'truth_or_dare';
    this.status = data.status || 'waiting';
    this.players = data.players || [];
    this.currentRoundNumber = data.currentRoundNumber || 0;
    this.spyGameState = data.spyGameState || null;
    this.turtleGameState = data.turtleGameState || null;
    this.casinoGameState = data.casinoGameState || null;
    this.createdAt = new Date();
  }

  async save() {
    const idx = memoryDb.rooms.findIndex(r => r.roomCode === this.roomCode);
    if (idx !== -1) {
      memoryDb.rooms[idx] = this;
    } else {
      memoryDb.rooms.push(this);
    }
    return this;
  }
}

class InMemoryRound {
  constructor(data) {
    this._id = memoryDb.createId();
    this.roomCode = data.roomCode;
    this.roundNumber = data.roundNumber;
    this.selectedPlayerId = data.selectedPlayerId;
    this.selectedPlayerName = data.selectedPlayerName;
    this.choice = data.choice || null;
    this.questionPrompt = data.questionPrompt || '';
    this.isCompleted = data.isCompleted || false;
    this.isSkipped = data.isSkipped || false;
    this.timestamp = new Date();
  }

  async save() {
    memoryDb.rounds.push(this);
    return this;
  }
}

class InMemoryUser {
  constructor(data) {
    this._id = memoryDb.createId();
    this.googleId = data.googleId;
    this.name = data.name;
    this.email = data.email;
    this.picture = data.picture;
    this.lastLoginAt = data.lastLoginAt || new Date();
    this.createdAt = new Date();
  }

  async save() {
    const idx = memoryDb.users.findIndex(u => u.googleId === this.googleId);
    if (idx !== -1) {
      memoryDb.users[idx] = this;
    } else {
      memoryDb.users.push(this);
    }
    return this;
  }
}

class InMemoryChat {
  constructor(data) {
    this._id = memoryDb.createId();
    this.user = data.user;
    this.message = data.message;
    this.time = data.time || new Date();
  }

  async save() {
    memoryDb.chats.push(this);
    if (memoryDb.chats.length > 200) memoryDb.chats.shift();
    return this;
  }
}

// 靜態方法模擬 Mongoose API
const MockRoomAPI = {
  async findOne(query) {
    // 支援 { roomCode } 與 { 'players.socketId': socket.id }
    if (query.roomCode) {
      const code = query.roomCode.toUpperCase();
      const found = memoryDb.rooms.find(r => r.roomCode === code);
      return found ? Object.assign(Object.create(InMemoryRoom.prototype), found) : null;
    }
    if (query['players.socketId']) {
      const socketId = query['players.socketId'];
      const found = memoryDb.rooms.find(r => r.players.some(p => p.socketId === socketId));
      return found ? Object.assign(Object.create(InMemoryRoom.prototype), found) : null;
    }
    return null;
  },

  async deleteOne(query) {
    if (query.roomCode) {
      const code = query.roomCode.toUpperCase();
      memoryDb.rooms = memoryDb.rooms.filter(r => r.roomCode !== code);
    }
    return { deletedCount: 1 };
  },

  async find() {
    return memoryDb.rooms.map(r => Object.assign(Object.create(InMemoryRoom.prototype), r));
  },

  createId() {
    return memoryDb.createId();
  }
};

const MockRoundAPI = {
  async findOne(query) {
    const { roomCode, roundNumber } = query;
    const found = memoryDb.rounds.find(r => r.roomCode === roomCode && r.roundNumber === roundNumber);
    return found ? Object.assign(Object.create(InMemoryRound.prototype), found) : null;
  },
  async findOneAndUpdate(query, update) {
    const { roomCode, roundNumber } = query;
    const found = memoryDb.rounds.find(r => r.roomCode === roomCode && r.roundNumber === roundNumber);
    if (found) {
      Object.assign(found, update);
      return found;
    }
    return null;
  }
};

const MockUserAPI = {
  async findOne(query) {
    if (query.googleId) {
      const found = memoryDb.users.find(u => u.googleId === query.googleId);
      return found ? Object.assign(Object.create(InMemoryUser.prototype), found) : null;
    }
    return null;
  },
  async find() {
    return memoryDb.users.map(u => Object.assign(Object.create(InMemoryUser.prototype), u));
  }
};

const MockChatAPI = {
  find() {
    // Return a fake Mongoose Query object that supports sort and limit
    return {
      sort: function() {
        const sorted = [...memoryDb.chats].sort((a, b) => new Date(b.time) - new Date(a.time));
        return {
          limit: function(n) {
            return Promise.resolve(sorted.slice(0, n));
          }
        }
      }
    };
  }
};

// 預設直接開啟 In-Memory Mock，防止異步連線過程中 Room 為 undefined
let RoomModel = MockRoomAPI;
let RoundModel = MockRoundAPI;
let UserModel = MockUserAPI;
let ChatModel = MockChatAPI;
let isInMemory = true;

// 3. 連線資料庫並決定使用何種模型
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/truth-or-dare';

mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 2000 // 2秒超時，超時自動維持內存模式
})
.then(() => {
  console.log('✅ MongoDB 連線成功。已將資料模型切換至實體 MongoDB。');
  RoomModel = mongoose.model('Room', RoomSchema);
  RoundModel = mongoose.model('Round', RoundSchema);
  UserModel = mongoose.model('User', UserSchema);
  ChatModel = mongoose.model('Chat', ChatSchema);
  isInMemory = false;
})
.catch((err) => {
  console.warn('⚠️ MongoDB 連線失敗，系統自動維持【內存資料庫 (In-Memory Mock) 模式】運行。所有資料將暫存於內存中，重啟 Server 後將重置。');
  // 保持預設的 Mock 狀態
});

// 當前 Room 模型的實例化封裝，能相容 new Room() 的寫法
function createRoomInstance(data) {
  if (isInMemory) {
    return new InMemoryRoom(data);
  } else {
    const MongooseRoom = mongoose.model('Room');
    return new MongooseRoom(data);
  }
}

function createRoundInstance(data) {
  if (isInMemory) {
    return new InMemoryRound(data);
  } else {
    const MongooseRound = mongoose.model('Round');
    return new MongooseRound(data);
  }
}

function createUserInstance(data) {
  if (isInMemory) {
    return new InMemoryUser(data);
  } else {
    const MongooseUser = mongoose.model('User');
    return new MongooseUser(data);
  }
}

function createChatInstance(data) {
  if (isInMemory) {
    return new InMemoryChat(data);
  } else {
    const MongooseChat = mongoose.model('Chat');
    return new MongooseChat(data);
  }
}

const RoomProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof RoomModel[prop] === 'function') return RoomModel[prop].bind(RoomModel);
    return RoomModel[prop];
  }
});

const RoundProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof RoundModel[prop] === 'function') return RoundModel[prop].bind(RoundModel);
    return RoundModel[prop];
  }
});

const UserProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof UserModel[prop] === 'function') return UserModel[prop].bind(UserModel);
    return UserModel[prop];
  }
});

const ChatProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof ChatModel[prop] === 'function') return ChatModel[prop].bind(ChatModel);
    return ChatModel[prop];
  }
});

// 導出模組
module.exports = {
  Room: RoomProxy,
  Round: RoundProxy,
  User: UserProxy,
  Chat: ChatProxy,
  createRoomInstance,
  createRoundInstance,
  createUserInstance,
  createChatInstance,
  getIsInMemory: () => isInMemory,
  createId: () => isInMemory ? MockRoomAPI.createId() : new mongoose.Types.ObjectId().toString()
};
