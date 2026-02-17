const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // Added http protocol as requested to prevent CORS blocks
    origin: ["https://quibluff.tech", "http://quibluff.tech", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Game State Storage
const rooms = new Map();

// Helper to broadcast state
const broadcastState = (roomCode) => {
  const room = rooms.get(roomCode);
  if (room) {
    io.to(roomCode).emit('game_state_update', room.state);
  }
};

// Game Loop Logic
const startGameLoop = (roomCode) => {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.timer) clearInterval(room.timer);

  room.timer = setInterval(() => {
    if (!rooms.has(roomCode)) return clearInterval(room.timer);

    const r = rooms.get(roomCode);
    const state = r.state;

    // Timer logic
    if (state.timeLeft > 0) {
      state.timeLeft--;
      // Bot Logic Trigger (Simplified)
      if (Math.random() > 0.8) runBotLogic(r);
    } else {
      // Time's up - Transition Phase
      handlePhaseTransition(r);
    }
    
    broadcastState(roomCode);
  }, 1000);
};

const runBotLogic = (room) => {
    const { state } = room;
    if (state.currentPhase === 'BLUFFING') {
        state.players.filter(p => p.isBot && !p.currentBluff).forEach(bot => {
             if (Math.random() > 0.9) bot.currentBluff = "Bot Bluff";
        });
    } else if (state.currentPhase === 'VOTING') {
        state.players.filter(p => p.isBot && !p.selectedAnswerId).forEach(bot => {
             if (Math.random() > 0.9 && state.currentOptions.length > 0) {
                 const randomOpt = state.currentOptions[Math.floor(Math.random() * state.currentOptions.length)];
                 bot.selectedAnswerId = randomOpt.id;
             }
        });
    }
};

const handlePhaseTransition = (room) => {
    const { state } = room;

    if (state.currentPhase === 'BLUFFING') {
        // Transition to VOTING
        const q = state.currentQuestion;
        if (!q) {
             state.currentPhase = 'LEADERBOARD';
             state.timeLeft = 5;
             return;
        }

        const options = [{ id: 'real', text: q.correctAnswer, authorId: 'SYSTEM' }];
        
        state.players.forEach(p => {
            if (p.currentBluff) options.push({ id: `bluff-${p.id}`, text: p.currentBluff, authorId: p.id });
            else if (p.isBot) options.push({ id: `bluff-${p.id}`, text: "Bot Answer", authorId: p.id });
        });
        
        state.currentOptions = options.sort(() => Math.random() - 0.5);
        state.currentPhase = 'VOTING';
        state.timeLeft = 30;

    } else if (state.currentPhase === 'VOTING') {
        // Transition to RESULT
        // Calculate scores
        state.players.forEach(p => {
            if (!p.selectedAnswerId) return;
            const selected = state.currentOptions.find(o => o.id === p.selectedAnswerId);
            if (!selected) return;

            if (selected.authorId === 'SYSTEM') {
                p.score += 1000;
            } else {
                const author = state.players.find(pl => pl.id === selected.authorId);
                if (author) author.score += 500;
            }
        });

        state.currentPhase = 'RESULT';
        state.timeLeft = 10;

    } else if (state.currentPhase === 'RESULT') {
        // Transition to LEADERBOARD
        state.currentPhase = 'LEADERBOARD';
        state.timeLeft = 5;

    } else if (state.currentPhase === 'LEADERBOARD') {
        // Next Round or End
        state.currentRound++;
        
        if (state.currentRound > state.totalRounds) {
            // End Game
            state.winner = [...state.players].sort((a,b) => b.score - a.score)[0];
            clearInterval(room.timer);
        } else {
            // Check if we have questions
            if (!room.questions || room.questions.length < state.currentRound) {
                console.error("Missing questions for round " + state.currentRound);
                state.winner = [...state.players].sort((a,b) => b.score - a.score)[0];
                clearInterval(room.timer);
                return;
            }

            // Next Question
            const q = room.questions[state.currentRound - 1];
            state.currentQuestion = q;
            state.currentOptions = q.options || []; 
            
            // Reset player state
            state.players.forEach(p => {
                p.currentBluff = undefined;
                p.selectedAnswerId = undefined;
            });
            
            if (state.mode === 'BLUFF') {
                state.currentPhase = 'BLUFFING';
                state.timeLeft = 45;
            } else {
                state.currentPhase = 'VOTING';
                state.timeLeft = state.timePerQuestion;
            }
        }
    }
};


io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', ({ nickname, avatarId }, callback) => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const playerId = socket.id; // Using socket.id as playerId
    
    const initialState = {
      roomCode: code,
      players: [{ id: playerId, nickname, avatarId, score: 0, isHost: true }],
      mode: 'BLUFF',
      currentPhase: 'LOBBY',
      currentRound: 0,
      totalRounds: 5,
      timePerQuestion: 30,
      currentOptions: [],
      timeLeft: 0
    };

    rooms.set(code, { state: initialState, questions: [], timer: null });
    socket.join(code);
    
    // IMPORTANT: Return code, playerId, and initial state to client immediately
    if (callback) {
        callback({ code, playerId, state: initialState });
    }
    
    broadcastState(code);
  });

  socket.on('join_room', ({ roomCode, nickname, avatarId }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) {
        if (callback) callback({ error: 'Room not found' });
        return;
    }
    
    const playerId = socket.id; // Using socket.id as playerId
    const newPlayer = { id: playerId, nickname, avatarId, score: 0, isHost: false };
    
    // Check if player already exists (reconnection logic basic)
    const existing = room.state.players.find(p => p.nickname === nickname); 
    if (!existing) {
        room.state.players.push(newPlayer);
    }
    
    socket.join(roomCode);
    
    // IMPORTANT: Return code, playerId, and current state to client immediately
    if (callback) {
        callback({ code: roomCode, playerId, state: room.state });
    }
    
    broadcastState(roomCode);
  });

  socket.on('update_settings', ({ settings, questions }, callback) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (!room) return;

    room.state.mode = settings.mode;
    // Set total rounds to actual number of questions generated to avoid mismatch
    room.state.totalRounds = questions.length;
    room.state.timePerQuestion = settings.time;
    room.questions = questions; 
    
    broadcastState(roomCode);
    
    if (callback) callback({ success: true });
  });

  socket.on('start_game', () => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    
    if (!room) return;
    if (!room.questions || room.questions.length === 0) {
        console.error("Cannot start game: No questions generated.");
        return;
    }

    // START GAME IMMEDIATELY - ROUND 1
    room.state.currentRound = 1;
    
    // Set First Question
    const q = room.questions[0];
    room.state.currentQuestion = q;
    
    // Reset player states
    room.state.players.forEach(p => {
        p.currentBluff = undefined;
        p.selectedAnswerId = undefined;
    });

    if (room.state.mode === 'BLUFF') {
        room.state.currentPhase = 'BLUFFING';
        room.state.currentOptions = []; 
        room.state.timeLeft = 45; // Give time to write
    } else {
        // Classic Mode
        room.state.currentPhase = 'VOTING';
        room.state.currentOptions = q.options || []; 
        room.state.timeLeft = room.state.timePerQuestion;
    }

    // Broadcast immediate start
    broadcastState(roomCode);
    
    // Start Loop
    startGameLoop(roomCode);
  });

  socket.on('submit_bluff', ({ text, playerId }) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (!room) return;

    const p = room.state.players.find(p => p.id === playerId);
    if (p) {
        p.currentBluff = text;
        broadcastState(roomCode);
    }
  });

  socket.on('submit_vote', ({ optionId, playerId }) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (!room) return;

    const p = room.state.players.find(p => p.id === playerId);
    if (p) {
        p.selectedAnswerId = optionId;
        broadcastState(roomCode);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});