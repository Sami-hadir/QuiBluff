import { GameState, Player, GameMode, GameSettings, Question, AnswerOption } from '../types';
import { generateQuestions } from './gemini';
import { BOT_NAMES } from '../constants';

// --- MOCK SOCKET SERVER ARCHITECTURE ---
// To satisfy the requirement for "strict room isolation" and fixing the participant sync bug
// without a real Node.js backend, we implement a Peer-to-Peer "Serverless" architecture.
// 
// 1. LocalStorage acts as the "Database" (Shared state between tabs).
// 2. BroadcastChannel acts as the "Socket.io Connection" (Real-time events).
// 3. The 'Host' client runs the game loop (timers, bot logic).

const CHANNEL = new BroadcastChannel('quibluff_socket_v1');
const STORAGE_KEY_PREFIX = 'quibluff_room_';

let localState: GameState | null = null;
let gameInterval: any = null;
let myPlayerId: string | null = null; // Track who "I" am in this module context
const subscribers: ((state: GameState) => void)[] = [];

// --- HELPER: SIMULATED IO.TO(ROOM).EMIT ---
const emitToRoom = (roomCode: string, newState: GameState) => {
  // 1. Update "Database"
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + roomCode, JSON.stringify(newState));
  } catch (e) {
    console.warn("LocalStorage full or unavailable");
  }

  // 2. Broadcast to other clients in this room (Simulates io.to(room).emit())
  CHANNEL.postMessage({
    type: 'UPDATE_STATE',
    room: roomCode,
    payload: newState
  });

  // 3. Update local view immediately
  localState = newState;
  notify();
};

// --- HELPER: SOCKET.ON ---
CHANNEL.onmessage = (event) => {
  const { type, room, payload } = event.data;

  // Strict Room Isolation: Ignore messages from other rooms
  // Simulates socket.join(roomCode) logic
  if (!localState || localState.roomCode !== room) return;

  if (type === 'UPDATE_STATE') {
    localState = payload;
    notify();
  }
};

const notify = () => {
  if (localState) {
    subscribers.forEach(cb => cb({ ...localState! }));
  }
};

// --- GAME LOGIC (RUNS ON HOST ONLY) ---

const runBotLogic = () => {
  if (!localState) return;

  // Only the host runs bot logic to avoid race conditions
  const amIHost = localState.players.find(p => p.id === myPlayerId)?.isHost;
  if (!amIHost) return;

  if (localState.currentPhase === 'BLUFFING') {
    // Bots submit fake answers
    const currentQ = localState.currentQuestion;
    if (!currentQ) return;

    localState.players.filter(p => p.isBot && !p.currentBluff).forEach(bot => {
      // Simulate delayed bot action
      if (Math.random() > 0.95) { // Small chance per tick to submit
         const fakeAnswers = ["תשובה לא נכונה", "משהו מצחיק", "אין לי מושג", "זה בטוח זה", "בלוף של בוט"];
         const randomBluff = fakeAnswers[Math.floor(Math.random() * fakeAnswers.length)];
         
         // Direct state mutation then emit (simulating server processing)
         bot.currentBluff = `${randomBluff} (${bot.nickname})`;
         emitToRoom(localState!.roomCode, { ...localState! });
      }
    });
  } else if (localState.currentPhase === 'VOTING') {
    // Bots vote
    localState.players.filter(p => p.isBot && !p.selectedAnswerId).forEach(bot => {
      if (Math.random() > 0.95) {
        const options = localState!.currentOptions.filter(o => o.authorId !== bot.id);
        const randomOpt = options[Math.floor(Math.random() * options.length)];
        if (randomOpt) {
            bot.selectedAnswerId = randomOpt.id;
            emitToRoom(localState!.roomCode, { ...localState! });
        }
      }
    });
  }
};

const startTimer = (onComplete: () => void) => {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (!localState) return;
    
    // Decrement Time
    const newState = { ...localState, timeLeft: localState.timeLeft - 1 };
    
    // Check for Bots
    runBotLogic();

    if (newState.timeLeft <= 0) {
      clearInterval(gameInterval);
      onComplete(); // Phase transition will emit its own state
    } else {
      emitToRoom(newState.roomCode, newState);
    }
  }, 1000);
};

// --- PUBLIC API ---

export const subscribeToGame = (callback: (state: GameState) => void) => {
  subscribers.push(callback);
  if (localState) callback({ ...localState });
  return () => {
    const idx = subscribers.indexOf(callback);
    if (idx !== -1) subscribers.splice(idx, 1);
  };
};

export const createRoom = (hostName: string, avatarId: string): { code: string, playerId: string } => {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const playerId = 'host-' + Date.now();
  myPlayerId = playerId;
  
  const newState: GameState = {
    roomCode: code,
    players: [{
      id: playerId,
      nickname: hostName,
      avatarId,
      score: 0,
      isHost: true
    }],
    mode: 'BLUFF',
    currentPhase: 'LOBBY',
    currentRound: 0,
    totalRounds: 5,
    timePerQuestion: 30,
    currentOptions: [],
    timeLeft: 0
  };
  
  // Add bots
  for(let i=0; i<3; i++) {
    newState.players.push({
      id: `bot-${i}`,
      nickname: BOT_NAMES[i],
      avatarId: ['🐶', '🐱', '🐭', '🐹', '🐰'][i],
      score: 0,
      isHost: false,
      isBot: true
    });
  }

  emitToRoom(code, newState);
  return { code, playerId };
};

export const joinRoom = (code: string, playerName: string, avatarId: string): { code: string, playerId: string } => {
  const playerId = 'player-' + Date.now();
  myPlayerId = playerId;

  // Try to find existing room in "Database"
  const stored = localStorage.getItem(STORAGE_KEY_PREFIX + code);
  
  let newState: GameState;

  if (stored) {
    newState = JSON.parse(stored);
    // Add new player if not already there
    if (!newState.players.find(p => p.id === playerId)) {
        newState.players.push({
            id: playerId,
            nickname: playerName,
            avatarId,
            score: 0,
            isHost: false
        });
    }
  } else {
    // Fallback: Create new room if not found (or throw error in real app)
    console.warn("Room not found, creating new instance locally");
    newState = {
        roomCode: code,
        players: [{
          id: playerId,
          nickname: playerName,
          avatarId,
          score: 0,
          isHost: false
        }],
        mode: 'BLUFF',
        currentPhase: 'LOBBY',
        currentRound: 0,
        totalRounds: 5,
        timePerQuestion: 30,
        currentOptions: [],
        timeLeft: 0
    };
  }

  emitToRoom(code, newState);
  return { code, playerId };
};

export const updateSettings = (settings: GameSettings) => {
  if (!localState) return;
  
  const newState = {
      ...localState,
      totalRounds: settings.rounds,
      timePerQuestion: settings.time,
      mode: settings.mode
  };

  // Pre-fetch questions (Async, so we emit twice)
  emitToRoom(newState.roomCode, newState);

  // In a real server, this would be stored on the backend. 
  // Here we attach a queue to the local memory of the host.
  // We need to store questions in state or localStorage to share them? 
  // For simplicity, we'll keep questions local to Host logic, as Host drives the rounds.
  generateQuestions(settings.topic, settings.rounds, settings.mode).then(qs => {
      // We'll store the questions in a hidden way or just in module scope
      // Since 'nextRound' uses them.
      (window as any).__QUESTION_QUEUE__ = qs;
  });
};

export const startGame = () => {
  if (!localState) return;
  
  // Check if questions are ready (Host only)
  const queue = (window as any).__QUESTION_QUEUE__;
  if (!queue || queue.length === 0) {
      console.warn("Questions loading...");
      setTimeout(startGame, 1000);
      return;
  }

  // Initialize Game
  const newState = {
      ...localState,
      currentRound: 0,
      currentPhase: 'SETTINGS' as any
  };
  emitToRoom(newState.roomCode, newState);
  
  // Start loop
  nextRound();
};

const nextRound = () => {
  if (!localState) return;
  
  const queue = (window as any).__QUESTION_QUEUE__;
  const nextRoundNum = localState.currentRound + 1;

  if (nextRoundNum > localState.totalRounds) {
    endGame();
    return;
  }

  const q = queue[nextRoundNum - 1];
  
  // Reset Player States
  const resetPlayers = localState.players.map(p => ({
      ...p,
      currentBluff: undefined,
      selectedAnswerId: undefined
  }));

  const newState: GameState = {
      ...localState,
      currentRound: nextRoundNum,
      currentQuestion: q,
      players: resetPlayers,
      currentOptions: [],
      timeLeft: localState.mode === 'BLUFF' ? 45 : localState.timePerQuestion,
      currentPhase: localState.mode === 'BLUFF' ? 'BLUFFING' : 'VOTING'
  };

  // Update State
  emitToRoom(newState.roomCode, newState);

  // Start Timer
  if (newState.currentPhase === 'BLUFFING') {
      startTimer(endBluffingPhase);
  } else {
      newState.currentOptions = q.options || [];
      emitToRoom(newState.roomCode, newState); // Re-emit with options
      startTimer(endVotingPhase);
  }
};

const endBluffingPhase = () => {
   if (!localState || !localState.currentQuestion) return;

   // Gather Bluffs
   const q = localState.currentQuestion;
   const options: AnswerOption[] = [
     { id: 'real', text: q.correctAnswer, authorId: 'SYSTEM' }
   ];

   localState.players.forEach(p => {
     if (p.currentBluff) {
         options.push({ id: `bluff-${p.id}`, text: p.currentBluff, authorId: p.id });
     } else if (p.isBot) {
         options.push({ id: `bluff-${p.id}`, text: "לא יודע", authorId: p.id });
     }
   });

   const newState: GameState = {
       ...localState,
       currentOptions: options.sort(() => Math.random() - 0.5),
       currentPhase: 'VOTING',
       timeLeft: 30
   };

   emitToRoom(newState.roomCode, newState);
   startTimer(endVotingPhase);
};

const endVotingPhase = () => {
    if (!localState) return;

    // Calc Scores
    const updatedPlayers = localState.players.map(p => {
        let score = p.score;
        const selected = localState!.currentOptions.find(o => o.id === p.selectedAnswerId);
        
        // Correct?
        if (selected?.authorId === 'SYSTEM') score += 1000;
        
        // Tricked someone?
        const trickedCount = localState!.players.filter(v => {
            const vSelected = localState!.currentOptions.find(o => o.id === v.selectedAnswerId);
            return vSelected?.authorId === p.id;
        }).length;
        score += (trickedCount * 500);

        return { ...p, score };
    });

    const newState: GameState = {
        ...localState,
        players: updatedPlayers,
        currentPhase: 'RESULT',
        timeLeft: 10
    };

    emitToRoom(newState.roomCode, newState);
    
    startTimer(() => {
        const lbState = { ...localState!, currentPhase: 'LEADERBOARD' as any, timeLeft: 5 };
        emitToRoom(lbState.roomCode, lbState);
        startTimer(nextRound);
    });
};

const endGame = () => {
    if (!localState) return;
    const sorted = [...localState.players].sort((a,b) => b.score - a.score);
    const newState = {
        ...localState,
        currentPhase: 'LEADERBOARD' as any,
        winner: sorted[0]
    };
    emitToRoom(newState.roomCode, newState);
};

// --- ACTION HANDLERS ---

export const submitBluff = (playerId: string, text: string) => {
   if (!localState) return;
   
   const updatedPlayers = localState.players.map(p => 
       p.id === playerId ? { ...p, currentBluff: text } : p
   );
   
   const newState = { ...localState, players: updatedPlayers };
   emitToRoom(newState.roomCode, newState);

   // If all humans submitted, fast forward? (Optional optimization)
};

export const submitVote = (playerId: string, optionId: string) => {
    if (!localState) return;

    const updatedPlayers = localState.players.map(p => 
        p.id === playerId ? { ...p, selectedAnswerId: optionId } : p
    );

    const newState = { ...localState, players: updatedPlayers };
    emitToRoom(newState.roomCode, newState);
};