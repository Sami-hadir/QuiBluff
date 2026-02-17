export type GameMode = 'CLASSIC' | 'BLUFF';
export type GamePhase = 'LOBBY' | 'SETTINGS' | 'QUESTION' | 'BLUFFING' | 'VOTING' | 'RESULT' | 'LEADERBOARD';

export interface Player {
  id: string;
  nickname: string;
  avatarId: string;
  score: number;
  isHost: boolean;
  isBot?: boolean;
  currentBluff?: string; // The fake answer they wrote
  selectedAnswerId?: string; // The answer they voted for
}

export interface Question {
  id: string;
  text: string;
  correctAnswer: string;
  // For Classic mode, these are pre-filled. For Bluff, generated dynamically or by players.
  options?: AnswerOption[]; 
  category?: string;
}

export interface AnswerOption {
  id: string;
  text: string;
  authorId?: string; // 'SYSTEM' if real answer, otherwise Player ID
}

export interface GameState {
  roomCode: string;
  players: Player[];
  mode: GameMode;
  currentPhase: GamePhase;
  currentRound: number;
  totalRounds: number;
  timePerQuestion: number;
  currentQuestion?: Question;
  currentOptions: AnswerOption[]; // The mixed list of answers (real + bluffs)
  timeLeft: number;
  winner?: Player;
}

export interface GameSettings {
  rounds: number;
  time: number;
  mode: GameMode;
  topic: string;
}