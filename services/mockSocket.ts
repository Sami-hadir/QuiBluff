import { io, Socket } from 'socket.io-client';
import { GameState, GameSettings } from '../types';
import { generateQuestions } from './gemini';

const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const { hostname, protocol, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};

let socket: Socket;
const subscribers: ((state: GameState) => void)[] = [];

const notify = (state: GameState) => {
  subscribers.forEach(cb => cb(state));
};

const getSocket = () => {
  if (!socket) {
    socket = io(getBaseUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      withCredentials: true // Ensure cookies/sessions work if needed
    });

    socket.on('connect', () => {
      console.log('Connected to Game Server:', socket.id);
    });

    socket.on('game_state_update', (state: GameState) => {
      notify(state);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from Game Server');
    });
  }
  return socket;
};

export const subscribeToGame = (callback: (state: GameState) => void) => {
  subscribers.push(callback);
  return () => {
    const idx = subscribers.indexOf(callback);
    if (idx !== -1) subscribers.splice(idx, 1);
  };
};

export const createRoom = (nickname: string, avatarId: string): Promise<{code: string, playerId: string}> => {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('create_room', { nickname, avatarId }, (response: any) => {
      if (!response || response.error) {
          reject(response?.error || 'Failed to create room');
      } else {
          // IMMEDIATE UPDATE: If server returns state, update UI immediately
          if (response.state) notify(response.state);
          resolve(response);
      }
    });
  });
};

export const joinRoom = (roomCode: string, nickname: string, avatarId: string): Promise<{code: string, playerId: string}> => {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit('join_room', { roomCode, nickname, avatarId }, (response: any) => {
      if (!response || response.error) {
          reject(response?.error || 'Failed to join room');
      } else {
          // IMMEDIATE UPDATE: If server returns state, update UI immediately
          if (response.state) notify(response.state);
          resolve(response);
      }
    });
  });
};

export const updateSettings = async (settings: GameSettings): Promise<void> => {
  // Generate questions on the Host client
  const questions = await generateQuestions(settings.topic, settings.rounds, settings.mode);
  
  return new Promise((resolve) => {
      getSocket().emit('update_settings', { settings, questions }, (response: any) => {
          // Wait for acknowledgment
          resolve();
      });
  });
};

export const startGame = () => {
  getSocket().emit('start_game');
};

export const submitBluff = (playerId: string, text: string) => {
  getSocket().emit('submit_bluff', { text, playerId });
};

export const submitVote = (playerId: string, optionId: string) => {
  getSocket().emit('submit_vote', { optionId, playerId });
};