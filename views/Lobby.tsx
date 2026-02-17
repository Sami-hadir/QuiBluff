import React, { useState } from 'react';
import { GameState, GameSettings } from '../types';
import { Button, Card, Input } from '../components/UI';
import { DEFAULT_SETTINGS, MOCK_TOPICS } from '../constants';
import * as GameService from '../services/mockSocket';
import { motion } from 'framer-motion';

interface LobbyProps {
  state: GameState;
  myId: string;
}

const InviteCard = ({ roomCode }: { roomCode: string }) => {
  const [copied, setCopied] = useState(false);
  const inviteLink = `${window.location.origin}?room=${roomCode}`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card title="הזמן חברים" className="flex flex-col gap-4 items-center text-center">
       <div className="bg-white p-2 rounded-xl border-4 border-black">
         <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(inviteLink)}`} 
            alt="QR Code" 
            className="w-32 h-32 md:w-40 md:h-40"
         />
       </div>
       
       <div className="w-full">
         <div className="text-gray-400 text-xs font-bold uppercase mb-1">קוד חדר</div>
         <div className="text-4xl font-black text-qb-yellow tracking-widest bg-slate-900/50 p-2 rounded-xl border-2 border-black/20 dashed">
            {roomCode}
         </div>
       </div>

       <Button 
         variant="secondary" 
         size="md" 
         fullWidth 
         onClick={handleCopy}
         className="text-sm"
       >
         {copied ? 'הקישור הועתק! 👍' : 'העתק קישור להזמנה 🔗'}
       </Button>
    </Card>
  );
};

const Lobby: React.FC<LobbyProps> = ({ state, myId }) => {
  const isHost = state.players.find(p => p.id === myId)?.isHost;
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
        console.log("Host starting game with settings:", settings);
        
        // 1. Send settings and questions to server, wait for ACK
        await GameService.updateSettings(settings);
        
        // 2. Only after ACK, send start signal
        GameService.startGame();
        
    } catch (e) {
        console.error("Error starting game:", e);
        alert("שגיאה ביצירת המשחק, אנא נסה שוב.");
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row p-4 gap-4 max-w-6xl mx-auto">
       {/* Left Col: Players */}
       <div className="flex-1 flex flex-col gap-4">
         <Card className="flex-1 min-h-[400px]" title={`חדר: ${state.roomCode}`}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {state.players.map(p => (
                    <motion.div 
                        key={p.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-2 p-4 bg-slate-700/50 rounded-xl border-2 border-transparent hover:border-qb-blue transition-colors"
                    >
                        <div className="text-4xl">{p.avatarId}</div>
                        <div className="font-bold text-center truncate w-full">{p.nickname}</div>
                        {p.isHost && <span className="text-xs bg-qb-yellow text-black px-2 py-0.5 rounded font-bold">מארח</span>}
                        {p.isBot && <span className="text-xs bg-gray-500 text-white px-2 py-0.5 rounded font-bold">בוט</span>}
                    </motion.div>
                ))}
            </div>
         </Card>
       </div>

       {/* Right Col: Settings (Host Only) or Waiting msg */}
       <div className="w-full md:w-96 flex flex-col gap-4">
          
          <InviteCard roomCode={state.roomCode} />

          {isHost ? (
              <Card title="הגדרות משחק" className="flex flex-col gap-6">
                
                <div>
                    <label className="block text-sm font-bold mb-2 ms-1 text-gray-300">מצב משחק</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => setSettings(prev => ({...prev, mode: 'BLUFF'}))}
                            className={`p-3 rounded-xl border-4 border-black font-bold transition-transform active:scale-95 ${settings.mode === 'BLUFF' ? 'bg-qb-purple shadow-neo text-white' : 'bg-slate-700 text-gray-400'}`}
                        >
                            בלוף
                        </button>
                        <button 
                            onClick={() => setSettings(prev => ({...prev, mode: 'CLASSIC'}))}
                            className={`p-3 rounded-xl border-4 border-black font-bold transition-transform active:scale-95 ${settings.mode === 'CLASSIC' ? 'bg-qb-blue shadow-neo text-white' : 'bg-slate-700 text-gray-400'}`}
                        >
                            רגיל
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold mb-2 ms-1 text-gray-300">נושא</label>
                    <select 
                        value={settings.topic}
                        onChange={(e) => setSettings(prev => ({...prev, topic: e.target.value}))}
                        className="w-full bg-slate-700 border-4 border-black rounded-xl px-4 py-3 text-white focus:outline-none focus:border-qb-yellow"
                    >
                        {MOCK_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="Random">אקראי</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-bold mb-2 ms-1 text-gray-300">סיבובים: {settings.rounds}</label>
                    <input 
                        type="range" min="3" max="10" 
                        value={settings.rounds}
                        onChange={(e) => setSettings(prev => ({...prev, rounds: Number(e.target.value)}))}
                        className="w-full accent-qb-yellow h-4 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        dir="ltr"
                    />
                </div>

                <Button 
                    variant="accent" 
                    size="lg" 
                    fullWidth 
                    onClick={handleStart}
                    disabled={loading}
                >
                    {loading ? 'מייצר שאלות...' : 'התחל משחק'}
                </Button>
              </Card>
          ) : (
              <Card className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <div className="text-6xl animate-bounce">⏳</div>
                  <h3 className="text-2xl font-bold">ממתין למארח...</h3>
                  <p className="text-gray-400">המשחק יתחיל בקרוב.</p>
              </Card>
          )}
       </div>
    </div>
  );
};

export default Lobby;