import React, { useState } from 'react';
import { GameState, AnswerOption } from '../types';
import { Button, Card, Input } from '../components/UI';
import * as GameService from '../services/mockSocket';
import { motion, AnimatePresence } from 'framer-motion';

interface GameplayProps {
  state: GameState;
  myId: string;
}

const Gameplay: React.FC<GameplayProps> = ({ state, myId }) => {
  const me = state.players.find(p => p.id === myId);
  const [bluffText, setBluffText] = useState('');
  const [submittedBluff, setSubmittedBluff] = useState(false);

  const handleSubmitBluff = () => {
    if (!bluffText.trim()) return;
    setSubmittedBluff(true);
    GameService.submitBluff(myId, bluffText);
  };

  const handleVote = (optionId: string) => {
    if (me?.selectedAnswerId) return; // Already voted
    GameService.submitVote(myId, optionId);
  };

  // Reset local state on new round
  React.useEffect(() => {
    if (state.currentPhase === 'BLUFFING') {
        setBluffText('');
        setSubmittedBluff(false);
    }
  }, [state.currentRound, state.currentPhase]);

  // Determine if we should show the Voting screen
  // 1. If phase is VOTING or QUESTION
  // 2. OR if we are in CLASSIC mode and have options (skipping the visual "Bluff" phase)
  const showVoting = 
    state.currentPhase === 'VOTING' || 
    state.currentPhase === 'QUESTION' || 
    (state.mode === 'CLASSIC' && state.currentOptions && state.currentOptions.length > 0);

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-4xl mx-auto">
      
      {/* Header Info */}
      <header className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border-2 border-black shadow-neo-sm">
        <div className="flex items-center gap-2">
            <span className="text-qb-blue font-black text-xl">סיבוב {state.currentRound}/{state.totalRounds}</span>
            {state.mode === 'CLASSIC' && <span className="text-xs bg-gray-600 text-white px-2 py-1 rounded">רגיל</span>}
        </div>
        <div className="flex items-center gap-2" dir="ltr">
            <span className="text-3xl">⏱</span>
            <span className={`text-2xl font-black ${state.timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {state.timeLeft}s
            </span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-qb-yellow font-black text-xl">ניקוד: {me?.score || 0}</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        
        {/* Phase: BLUFFING (Only show if phase matches AND mode is BLUFF) */}
        {state.currentPhase === 'BLUFFING' && state.mode === 'BLUFF' && (
           <motion.div 
             key="bluffing"
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, x: -50 }}
             className="flex-1 flex flex-col justify-center"
           >
              <Card className="w-full bg-qb-blue border-white/20">
                 <h2 className="text-2xl md:text-4xl font-black text-white text-center mb-8 drop-shadow-md">
                    {state.currentQuestion?.text}
                 </h2>
              </Card>

              <div className="mt-8">
                 {!submittedBluff ? (
                     <Card title="כתוב תשובה שיקרית!" className="bg-slate-800">
                        <Input 
                            placeholder="כתוב משהו אמין..." 
                            value={bluffText}
                            onChange={(e) => setBluffText(e.target.value)}
                            maxLength={50}
                            className="text-center text-xl"
                            autoFocus
                        />
                        <Button variant="accent" size="xl" fullWidth className="mt-6" onClick={handleSubmitBluff}>
                            שלח בלוף
                        </Button>
                     </Card>
                 ) : (
                    <div className="text-center p-8">
                        <h3 className="text-3xl font-bold text-qb-green mb-4">הבלוף נשלח!</h3>
                        <p className="text-gray-400 animate-pulse">ממתין לשחקנים אחרים...</p>
                    </div>
                 )}
              </div>
           </motion.div>
        )}

        {/* Phase: VOTING or CLASSIC MODE */}
        {showVoting && (
            <motion.div 
                key="voting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="flex-1 flex flex-col"
            >
                <div className="bg-qb-blue p-6 rounded-2xl border-4 border-black shadow-neo mb-8">
                    <h2 className="text-xl md:text-3xl font-bold text-white text-center">
                        {state.currentQuestion?.text}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {state.currentOptions.map((opt) => {
                        const isSelected = me?.selectedAnswerId === opt.id;
                        const disabled = !!me?.selectedAnswerId || opt.authorId === myId; // Can't vote for self
                        
                        return (
                            <button
                                key={opt.id}
                                disabled={disabled}
                                onClick={() => handleVote(opt.id)}
                                className={`
                                    relative p-6 rounded-xl border-4 border-black text-lg md:text-xl font-bold transition-all
                                    ${isSelected ? 'bg-qb-yellow text-black scale-95 ring-4 ring-white' : 'bg-slate-700 text-white hover:bg-slate-600 active:scale-95 shadow-neo'}
                                    ${disabled && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${opt.authorId === myId ? 'opacity-100 bg-slate-800 border-dashed' : ''}
                                `}
                            >
                                {opt.text}
                                {opt.authorId === myId && (
                                    <span className="absolute top-2 left-2 text-xs bg-gray-500 px-2 rounded text-white">הבלוף שלך</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </motion.div>
        )}

        {/* Phase: RESULT */}
        {state.currentPhase === 'RESULT' && (
            <motion.div 
                key="result"
                className="flex-1 flex flex-col gap-4"
            >
                <div className="text-center mb-6">
                    <h2 className="text-4xl font-black text-white mb-2">תוצאות</h2>
                </div>

                <div className="grid gap-3">
                    {state.currentOptions.map((opt) => {
                        const isCorrect = opt.authorId === 'SYSTEM' && opt.text === state.currentQuestion?.correctAnswer;
                        const voters = state.players.filter(p => p.selectedAnswerId === opt.id);
                        const isMySelection = me?.selectedAnswerId === opt.id;
                        
                        // In Classic Mode, SYSTEM is always the author, so we check correctAnswer text match or metadata logic if available
                        // For simplicity in this structure: The server usually marks correct one. 
                        // But here, since we rely on authorId='SYSTEM', let's double check against the stored correct Answer text
                        const actuallyCorrect = opt.text === state.currentQuestion?.correctAnswer;

                        return (
                            <div 
                                key={opt.id}
                                className={`
                                    p-4 rounded-xl border-4 border-black flex justify-between items-center relative overflow-hidden
                                    ${actuallyCorrect ? 'bg-green-600 text-white border-green-800' : 'bg-slate-700 text-gray-300'}
                                    ${isMySelection && !actuallyCorrect ? 'ring-4 ring-red-500' : ''}
                                `}
                            >
                                <div className="z-10 relative flex-1">
                                    <span className="font-bold text-xl block">{opt.text}</span>
                                    {/* Show author only in Bluff mode if it's not system */}
                                    {!actuallyCorrect && opt.authorId && opt.authorId !== 'SYSTEM' && state.mode === 'BLUFF' && (
                                        <span className="text-xs text-black bg-white/50 px-2 rounded mt-1 inline-block">
                                            בלוף של: {state.players.find(p => p.id === opt.authorId)?.nickname}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex -space-x-2 space-x-reverse z-10 relative">
                                    {voters.map(v => (
                                        <div key={v.id} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-black flex items-center justify-center text-sm" title={v.nickname}>
                                            {v.avatarId}
                                        </div>
                                    ))}
                                </div>
                                
                                {actuallyCorrect && <div className="absolute inset-0 bg-white/10 animate-pulse"></div>}
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        )}

         {/* Phase: LEADERBOARD */}
         {state.currentPhase === 'LEADERBOARD' && (
            <motion.div 
                key="leaderboard"
                className="flex-1 flex flex-col items-center justify-center"
            >
                <h2 className="text-5xl font-black text-qb-yellow mb-8 drop-shadow-lg text-center">טבלת מובילים</h2>
                <div className="w-full max-w-md flex flex-col gap-4">
                    {[...state.players].sort((a,b) => b.score - a.score).map((p, index) => (
                        <motion.div 
                            key={p.id}
                            initial={{ x: -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={`
                                flex items-center p-4 rounded-xl border-4 border-black shadow-neo
                                ${index === 0 ? 'bg-qb-yellow text-black scale-110 z-10' : 'bg-slate-700 text-white'}
                            `}
                        >
                            <span className="font-black text-2xl w-8">#{index + 1}</span>
                            <span className="text-3xl ms-4">{p.avatarId}</span>
                            <span className="font-bold text-xl flex-1">{p.nickname}</span>
                            <span className="font-black text-xl">{p.score} נק'</span>
                        </motion.div>
                    ))}
                </div>

                {state.winner && (
                    <div className="mt-10 text-center animate-bounce">
                        <h1 className="text-6xl">🏆</h1>
                        <h2 className="text-3xl font-bold text-white mt-2">{state.winner.nickname} ניצח!</h2>
                        <Button variant="primary" size="lg" className="mt-8" onClick={() => window.location.reload()}>שחק שוב</Button>
                    </div>
                )}
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default Gameplay;