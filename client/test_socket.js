import { io } from 'socket.io-client';
const url = 'http://localhost:3001';

const playerA = io(url);
const playerB = io(url);

playerA.on('connect', () => {
  console.log('Player A connected:', playerA.id);
  playerA.emit('createRoom', { nickname: 'PlayerA' });
});

playerA.on('joinSuccess', (data) => {
  console.log('Player A joinSuccess:', data.roomCode);
  const code = data.roomCode;
  
  playerA.on('roomUpdated', (room) => {
    console.log('Player A roomUpdated! Players:', room.players.length);
  });
  
  setTimeout(() => {
    console.log('Player B joining', code);
    playerB.emit('joinRoom', { roomCode: code, nickname: 'PlayerB' });
  }, 1000);
});

playerB.on('joinSuccess', (data) => {
  console.log('Player B joinSuccess:', data.roomCode);
});

playerB.on('roomUpdated', (room) => {
  console.log('Player B roomUpdated! Players:', room.players.length);
});

setTimeout(() => {
  process.exit();
}, 3000);
