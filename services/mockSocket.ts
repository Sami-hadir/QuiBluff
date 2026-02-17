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
      withCredentials: true
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
          if (response.state) notify(response.state);
          resolve(response);
      }
    });
  });
};

export const updateSettings = async (settings: GameSettings): Promise<void> => {
  console.log("Generating questions for topic:", settings.topic, "Mode:", settings.mode);
  
  // 1. Generate questions on the Host client using Gemini
  const questions = await generateQuestions(settings.topic, settings.rounds, settings.mode);
  
  console.log("Questions generated:", questions.length, "Sending to server...");

  // 2. Send settings AND questions to server and WAIT for acknowledgment (Callback)
  return new Promise((resolve, reject) => {
      getSocket().emit('update_settings', { settings, questions }, (response: any) => {
          if (response && response.success) {
            console.log("Server acknowledged settings update.");
            resolve();
          } else {
            console.error("Server failed to update settings");
            reject("Server failed to update settings");
          }
      });
  });
};

export const startGame = () => {
  console.log("Emitting start_game...");
  getSocket().emit('start_game');
};

export const submitBluff = (playerId: string, text: string) => {
  getSocket().emit('submit_bluff', { text, playerId });
};

export const submitVote = (playerId: string, optionId: string) => {
  getSocket().emit('submit_vote', { optionId, playerId });
};