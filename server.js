import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// הגדרת תיקיית ה-dist של ה-Frontend
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://quibluff.tech", "http://quibluff.tech"],
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

const broadcastState = (roomCode) => {
  const room = rooms.get(roomCode);
  if (room) io.to(roomCode).emit('game_state_update', room.state);
};

const handlePhaseTransition = (room, roomCode) => {
  const { state } = room;
  
  if (state.currentPhase === 'BLUFFING') {
    // מעבר מבלוף להצבעה (קורה רק במצב BLUFF)
    state.currentPhase = 'VOTING';
    state.timeLeft = 30;
    const q = state.currentQuestion;
    
    // יצירת אופציות למצב בלוף: התשובה הנכונה + הבלופים של השחקנים
    const options = [{ id: 'real', text: q.correctAnswer, authorId: 'SYSTEM' }];
    state.players.forEach(p => {
      if (p.currentBluff) options.push({ id: `bluff-${p.id}`, text: p.currentBluff, authorId: p.id });
    });
    // ערבוב האופציות
    state.currentOptions = options.sort(() => Math.random() - 0.5);

  } else if (state.currentPhase === 'VOTING') {
    // מעבר מהצבעה לתוצאות - כאן מחשבים ניקוד
    
    const correctText = state.currentQuestion.correctAnswer;
    
    state.players.forEach(p => {
        if (p.selectedAnswerId) {
            const selectedOption = state.currentOptions.find(opt => opt.id === p.selectedAnswerId);
            
            if (selectedOption) {
                // 1. ניקוד על תשובה נכונה
                const isCorrect = selectedOption.text === correctText; 
                
                if (isCorrect) {
                    p.score += 100;
                }

                // 2. ניקוד על בלוף (רק במצב BLUFF)
                // אם מישהו בחר בתשובה שלי, והיא לא התשובה הנכונה, אני מקבל נקודות
                if (state.mode === 'BLUFF' && selectedOption.authorId && selectedOption.authorId !== 'SYSTEM' && !isCorrect) {
                    const bluffer = state.players.find(b => b.id === selectedOption.authorId);
                    if (bluffer) {
                        bluffer.score += 50; 
                    }
                }
            }
        }
    });

    state.currentPhase = 'RESULT';
    state.timeLeft = 10;

  } else if (state.currentPhase === 'RESULT') {
    // מעבר לשאלה הבאה או לסיום
    state.currentRound++;
    if (state.currentRound > state.totalRounds) {
      state.currentPhase = 'LEADERBOARD';
      
      // חישוב מנצח
      const winner = state.players.reduce((prev, current) => (prev.score > current.score) ? prev : current, state.players[0]);
      state.winner = winner;

      state.timeLeft = 0;
      if (room.timer) clearInterval(room.timer);
    } else {
      // הכנת השאלה הבאה
      const nextQ = room.questions[state.currentRound - 1];
      state.currentQuestion = nextQ;
      
      // איפוס בחירות
      state.players.forEach(p => { p.currentBluff = null; p.selectedAnswerId = null; });
      
      if (state.mode === 'CLASSIC') {
        state.currentPhase = 'VOTING'; // מדלגים על שלב הבלוף
        // שימוש ישיר באופציות המוכנות שמגיעות מהקליינט (תשובה נכונה + 3 מסיחים)
        state.currentOptions = nextQ.options || []; 
        state.timeLeft = 30;
      } else {
        state.currentPhase = 'BLUFFING';
        state.currentOptions = []; // מאפסים אופציות עד שלב ההצבעה
        state.timeLeft = 45;
      }
    }
  }
  broadcastState(roomCode);
};

const startGameLoop = (roomCode) => {
  const room = rooms.get(roomCode);
  if (room.timer) clearInterval(room.timer);
  room.timer = setInterval(() => {
    const r = rooms.get(roomCode);
    if (!r) return clearInterval(room.timer);
    if (r.state.timeLeft > 0) {
      r.state.timeLeft--;
      broadcastState(roomCode);
    } else {
      handlePhaseTransition(r, roomCode);
    }
  }, 1000);
};

io.on('connection', (socket) => {
  socket.on('create_room', ({ nickname, avatarId }, callback) => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const initialState = {
      roomCode: code,
      players: [{ id: socket.id, nickname, avatarId, score: 0, isHost: true }],
      mode: 'BLUFF',
      currentPhase: 'LOBBY',
      currentRound: 0,
      totalRounds: 5,
      timeLeft: 0
    };
    rooms.set(code, { state: initialState, questions: [], timer: null });
    socket.join(code);
    if (callback) callback({ code, playerId: socket.id, state: initialState });
  });

  socket.on('join_room', ({ roomCode, nickname, avatarId }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return callback?.({ error: 'Room not found' });
    room.state.players.push({ id: socket.id, nickname, avatarId, score: 0, isHost: false });
    socket.join(roomCode);
    if (callback) callback({ code: roomCode, playerId: socket.id, state: room.state });
    broadcastState(roomCode);
  });

  socket.on('update_settings', ({ settings, questions }, callback) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (room) {
      room.state.mode = settings.mode;
      room.state.totalRounds = settings.rounds;
      room.questions = questions;
      broadcastState(roomCode);
      if (callback) callback({ success: true });
    }
  });

  socket.on('start_game', () => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (room && room.questions.length > 0) {
      room.state.currentRound = 1;
      const q = room.questions[0];
      room.state.currentQuestion = q;
      
      if (room.state.mode === 'CLASSIC') {
        room.state.currentPhase = 'VOTING';
        // שימוש ישיר באופציות המוכנות
        room.state.currentOptions = q.options || [];
        room.state.timeLeft = 30;
      } else {
        room.state.currentPhase = 'BLUFFING';
        room.state.currentOptions = [];
        room.state.timeLeft = 45;
      }
      broadcastState(roomCode);
      startGameLoop(roomCode);
    }
  });

  socket.on('submit_bluff', ({ text, playerId }) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (room) {
        const p = room.state.players.find(pl => pl.id === playerId);
        if (p) p.currentBluff = text;
        broadcastState(roomCode);
    }
  });

  socket.on('submit_vote', ({ optionId, playerId }) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (room) {
        const p = room.state.players.find(pl => pl.id === playerId);
        if (p) p.selectedAnswerId = optionId;
        broadcastState(roomCode);
    }
  });
});

// פתרון חסין תקלות לניתוב (למניעת 502)
app.use((req, res, next) => {
  const ext = path.extname(req.path);
  if (ext !== '' && ext !== '.html') {
    next();
  } else {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});