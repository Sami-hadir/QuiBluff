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

  // Clear existing timer to prevent double-speed or race conditions
  if (room.timer) clearInterval(room.timer);

  room.timer = setInterval(() => {
    if (!rooms.has(roomCode)) return clearInterval(room.timer);

    const r = rooms.get(roomCode);
    const state = r.state;

    // Timer logic
    if (state.timeLeft > 0) {
      state.timeLeft--;
      
      // Bot Logic Trigger
      if (Math.random() > 0.85) runBotLogic(r);
      
    } else {
      // Time's up - Transition Phase
      handlePhaseTransition(r);
    }
    
    broadcastState(roomCode);
  }, 1000);
};

const runBotLogic = (room) => {
    const { state } = room;
    // Bots submit bluffs in BLUFF mode
    if (state.currentPhase === 'BLUFFING') {
        state.players.filter(p => p.isBot && !p.currentBluff).forEach(bot => {
             // Delay bot action slightly
             if (Math.random() > 0.8) bot.currentBluff = "תשובה של בוט";
        });
    } 
    // Bots vote in VOTING mode
    else if (state.currentPhase === 'VOTING') {
        state.players.filter(p => p.isBot && !p.selectedAnswerId).forEach(bot => {
             if (Math.random() > 0.8 && state.currentOptions.length > 0) {
                 const randomOpt = state.currentOptions[Math.floor(Math.random() * state.currentOptions.length)];
                 bot.selectedAnswerId = randomOpt.id;
             }
        });
    }
};

const handlePhaseTransition = (room) => {
    const { state } = room;

    // --- FROM BLUFFING TO VOTING ---
    if (state.currentPhase === 'BLUFFING') {
        const q = state.currentQuestion;
        
        // Safety check: if no question, go to leaderboard (end of game/error)
        if (!q) {
             state.currentPhase = 'LEADERBOARD';
             state.timeLeft = 5;
             return;
        }

        // Collect all answers: Real Answer + Player Bluffs + Bot Bluffs
        const options = [{ id: 'real', text: q.correctAnswer, authorId: 'SYSTEM' }];
        
        state.players.forEach(p => {
            if (p.currentBluff) options.push({ id: `bluff-${p.id}`, text: p.currentBluff, authorId: p.id });
            else if (p.isBot) options.push({ id: `bluff-${p.id}`, text: "תשובה בוטית", authorId: p.id });
        });
        
        // Shuffle options
        state.currentOptions = options.sort(() => Math.random() - 0.5);
        state.currentPhase = 'VOTING';
        state.timeLeft = 30;
    } 
    
    // --- FROM VOTING TO RESULT ---
    else if (state.currentPhase === 'VOTING') {
        // Calculate scores
        state.players.forEach(p => {
            if (!p.selectedAnswerId) return;
            const selected = state.currentOptions.find(o => o.id === p.selectedAnswerId);
            if (!selected) return;

            // Points for correct answer
            if (selected.authorId === 'SYSTEM') {
                p.score += 1000;
            } else {
                // Points for fooling someone (BLUFF mode only mostly, but logic works for both)
                const author = state.players.find(pl => pl.id === selected.authorId);
                if (author) author.score += 500;
            }
        });

        state.currentPhase = 'RESULT';
        state.timeLeft = 10;
    } 
    
    // --- FROM RESULT TO LEADERBOARD (Or Next Round) ---
    else if (state.currentPhase === 'RESULT') {
        state.currentPhase = 'LEADERBOARD';
        state.timeLeft = 5; // Show leaderboard for 5 seconds before next round
    } 
    
    // --- FROM LEADERBOARD TO NEXT ROUND ---
    else if (state.currentPhase === 'LEADERBOARD') {
        state.currentRound++;
        
        // Check if Game Over
        if (state.currentRound > state.totalRounds || !room.questions || room.questions.length < state.currentRound) {
            state.winner = [...state.players].sort((a,b) => b.score - a.score)[0];
            clearInterval(room.timer); // Stop the loop
            return;
        }

        // Setup Next Question
        const q = room.questions[state.currentRound - 1]; // Array is 0-indexed, Round is 1-indexed
        state.currentQuestion = q;
        
        // Reset player round-state
        state.players.forEach(p => {
            p.currentBluff = undefined;
            p.selectedAnswerId = undefined;
        });
        
        // Set Phase based on Mode
        if (state.mode === 'BLUFF') {
            state.currentPhase = 'BLUFFING';
            state.currentOptions = []; // Clear options, waiting for bluffs
            state.timeLeft = 45;
        } else {
            // CLASSIC MODE
            state.currentPhase = 'VOTING';
            // CRITICAL: Load the pre-generated options for Classic mode
            state.currentOptions = q.options || []; 
            state.timeLeft = state.timePerQuestion || 30;
        }
    }
};


io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', ({ nickname, avatarId }, callback) => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const playerId = socket.id;
    
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
    
    if (callback) callback({ code, playerId, state: initialState });
    broadcastState(code);
  });

  socket.on('join_room', ({ roomCode, nickname, avatarId }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) {
        if (callback) callback({ error: 'Room not found' });
        return;
    }
    
    const playerId = socket.id;
    const newPlayer = { id: playerId, nickname, avatarId, score: 0, isHost: false };
    
    const existing = room.state.players.find(p => p.nickname === nickname); 
    if (!existing) {
        room.state.players.push(newPlayer);
    }
    
    socket.join(roomCode);
    
    if (callback) callback({ code: roomCode, playerId, state: room.state });
    broadcastState(roomCode);
  });

  socket.on('update_settings', ({ settings, questions }, callback) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    if (!room) return;

    // Update Room State
    room.state.mode = settings.mode; // 'BLUFF' or 'CLASSIC'
    room.state.totalRounds = questions.length; // Sync with actual generated count
    room.state.timePerQuestion = settings.time;
    room.questions = questions; // Save questions to server memory
    
    console.log(`Room ${roomCode} updated: Mode=${settings.mode}, Questions=${questions.length}`);
    
    broadcastState(roomCode);
    if (callback) callback({ success: true });
  });

  socket.on('start_game', () => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    const room = rooms.get(roomCode);
    
    if (!room) return;
    if (!room.questions || room.questions.length === 0) {
        console.error("Cannot start game: No questions available.");
        return;
    }

    // --- INITIALIZE GAME START ---
    
    // Clear any existing timer to avoid conflicts
    if (room.timer) clearInterval(room.timer);

    room.state.currentRound = 1;
    const q = room.questions[0];
    room.state.currentQuestion = q;
    
    // Reset players
    room.state.players.forEach(p => {
        p.currentBluff = undefined;
        p.selectedAnswerId = undefined;
        p.score = 0; // Reset score on new game
    });

    // Determine Initial Phase based on Mode
    if (room.state.mode === 'BLUFF') {
        room.state.currentPhase = 'BLUFFING';
        room.state.currentOptions = []; // Clear options
        room.state.timeLeft = 45; 
    } else {
        // CLASSIC MODE -> Jump straight to Voting
        room.state.currentPhase = 'VOTING';
        // IMPORTANT: Load options immediately for Classic mode
        room.state.currentOptions = q.options || []; 
        room.state.timeLeft = room.state.timePerQuestion;
    }

    console.log(`Starting game in room ${roomCode}. Mode: ${room.state.mode}, Phase: ${room.state.currentPhase}`);

    broadcastState(roomCode);
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
    // Optional: handle cleanup
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});