import React, { useState, useEffect } from 'react';
import Home from './views/Home';
import Lobby from './views/Lobby';
import Gameplay from './views/Gameplay';
import { GameState } from './types';
import * as GameService from './services/mockSocket';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inGame, setInGame] = useState(false);
  const [myId, setMyId] = useState<string>('');

  useEffect(() => {
    // Subscribe to game state updates
    const unsubscribe = GameService.subscribeToGame((newState) => {
      setGameState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleJoin = (playerId: string) => {
    setInGame(true);
    setMyId(playerId);
  };

  if (!inGame) {
    return <Home onJoin={handleJoin} />;
  }

  if (!gameState) return <div className="text-white">Loading...</div>;

  // Render view based on Phase
  if (gameState.currentPhase === 'LOBBY' || gameState.currentPhase === 'SETTINGS') {
    return <Lobby state={gameState} myId={myId} />;
  }

  return <Gameplay state={gameState} myId={myId} />;
};

export default App;