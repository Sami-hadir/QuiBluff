import React, { useState, useEffect } from 'react';
import { Button, Card, Input } from '../components/UI';
import { AVATARS } from '../constants';
import * as GameService from '../services/mockSocket';
import { AnimatePresence, motion } from 'framer-motion';

interface HomeProps {
  onJoin: (playerId: string) => void;
}

const Home: React.FC<HomeProps> = ({ onJoin }) => {
  const [view, setView] = useState<'DASHBOARD' | 'SETUP'>('DASHBOARD');
  
  // Setup State
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check for room code in URL
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
        setRoomCode(room);
        setView('SETUP');
    }
  }, []);

  const handleAction = async () => {
    if (!nickname.trim()) return alert("אנא הכנס כינוי!");
    setIsSubmitting(true);
    
    try {
        let result;
        if (roomCode.trim()) {
            result = await GameService.joinRoom(roomCode, nickname, avatar);
        } else {
            result = await GameService.createRoom(nickname, avatar);
        }
        
        if (result && result.playerId) {
            onJoin(result.playerId);
        }
    } catch (error: any) {
        alert("שגיאה: " + (error.message || error || "Connection failed"));
        console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white pb-24 font-sans selection:bg-purple-500 selection:text-white overflow-y-auto">
      
      <AnimatePresence mode="wait">
        {view === 'DASHBOARD' ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col"
          >
            {/* Header */}
            <header className="p-4 pt-6 flex justify-between items-start max-w-6xl mx-auto w-full">
               {/* Right side in RTL (Visually Right) - Welcome */}
               <div className="text-right">
                  <h1 className="text-2xl md:text-3xl font-black italic tracking-wide text-white">ברוך הבא!</h1>
                  <p className="text-gray-400 text-sm md:text-base font-medium">מוכן לסיבוב?</p>
               </div>

               {/* Left side in RTL (Visually Left) - Coins & Globe */}
               <div className="flex items-center gap-3 flex-row-reverse">
                   {/* Globe Icon */}
                   <div className="bg-[#1E293B] border-2 border-[#334155] rounded-full p-2 w-10 h-10 flex items-center justify-center shadow-sm cursor-pointer hover:bg-slate-700 transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S12 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S12 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                     </svg>
                  </div>
                  {/* Coin Pill */}
                  <div className="bg-[#1E293B] border-2 border-[#334155] rounded-full pl-3 pr-4 py-1.5 flex items-center gap-2 shadow-sm">
                     <span className="text-yellow-400 text-lg">🪙</span>
                     <span className="font-bold text-yellow-400">0</span>
                  </div>
               </div>
            </header>

            <main className="p-4 space-y-6 max-w-6xl mx-auto w-full">
               {/* Top Stats Grid */}
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Empty Slot */}
                  <div className="aspect-[4/3] rounded-2xl border-4 border-dashed border-[#334155] bg-[#0F172A] flex items-center justify-center hover:bg-[#1E293B] transition-colors cursor-pointer group">
                     <span className="text-slate-600 text-4xl font-black group-hover:text-slate-500 transition-colors">...</span>
                  </div>
                  
                  {/* Day Streak */}
                  <StatsCard 
                    bg="bg-[#F97316]" 
                    border="border-[#C2410C]" 
                    icon={<span className="text-4xl filter drop-shadow-md">🔥</span>}
                    value="0" 
                    label="רצף ימים" 
                  />
                  
                  {/* Current Rank */}
                  <StatsCard 
                    bg="bg-[#0EA5E9]" 
                    border="border-[#0369A1]" 
                    icon={<span className="text-4xl filter drop-shadow-md">⭐</span>}
                    value="PRO" 
                    label="דרגה נוכחית" 
                  />
                  
                  {/* Questions Solved */}
                  <StatsCard 
                    bg="bg-[#3B82F6]" 
                    border="border-[#1D4ED8]" 
                    icon={<span className="text-4xl filter drop-shadow-md">🏆</span>}
                    value="0" 
                    label="שאלות נפתרו" 
                  />
               </div>

               {/* Middle Section */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Hero / Start Game */}
                  <div 
                    onClick={() => setView('SETUP')}
                    className="md:col-span-2 bg-[#FFD200] rounded-3xl p-8 border-b-8 border-[#EAB308] relative overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer group active:border-b-0 active:translate-y-2 transition-all"
                  >
                     {/* Pattern Overlay */}
                     <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
                     
                     <div className="relative z-10 flex flex-col items-center gap-6">
                        <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300 ring-4 ring-black/20">
                           <svg viewBox="0 0 24 24" fill="white" className="w-12 h-12 ml-1"><path d="M8 5v14l11-7z"/></svg> 
                        </div>
                        <div>
                           <h2 className="text-4xl md:text-5xl font-black text-black uppercase tracking-tight drop-shadow-sm">התחל משחק</h2>
                           <p className="text-black/70 font-bold mt-2 text-lg">הצטרף לחדר או צור חדש</p>
                        </div>
                        <div className="bg-white/30 px-6 py-2 rounded-full text-black font-black text-sm uppercase tracking-wider backdrop-blur-sm">
                            לחץ כדי לשחק
                        </div>
                     </div>
                  </div>

                  {/* Daily Challenges */}
                  <div className="md:col-span-1 bg-[#1E293B] rounded-3xl p-5 border-b-8 border-[#020617] flex flex-col gap-4">
                     <div className="flex justify-between items-end">
                        <h3 className="font-bold text-lg text-gray-200">אתגרים יומיים 🔥</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400 font-mono mb-1" dir="ltr">
                           <span>10h 31m</span> <span>🕒</span>
                        </div>
                     </div>
                     
                     <div className="space-y-4">
                        <ChallengeRow 
                           color="text-green-400" 
                           icon="✅" 
                           title="ענה נכון על 5 שאלות" 
                           reward="150+" 
                           progress={0} 
                           total={5} 
                        />
                        <ChallengeRow 
                           color="text-yellow-400" 
                           icon="🥇" 
                           title="נצח ב-1 משחקים (מקום 1)" 
                           reward="600+" 
                           progress={0} 
                           total={1} 
                        />
                        <ChallengeRow 
                           color="text-purple-400" 
                           icon="💰" 
                           title="צבור 10000 נקודות במצטבר" 
                           reward="1000+" 
                           progress={0} 
                           total={10000} 
                        />
                     </div>
                  </div>

               </div>
            </main>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0F172A] border-t border-slate-800 z-50">
               <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-purple-500 to-yellow-400"></div>
               <div className="flex justify-around items-center p-3 max-w-md mx-auto">
                   <NavItem icon={<UserIcon />} label="חשבון" />
                   <NavItem icon={<ShopIcon />} label="חנות" />
                   <NavItem icon={<GameIcon />} label="משחק" />
                   <NavItem icon={<HomeIcon />} label="בית" active />
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
             key="setup"
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 1.05 }}
             className="min-h-screen flex items-center justify-center p-4 relative z-50"
          >
             {/* Simple Header for Setup View */}
             <div className="absolute top-4 right-4">
                <button onClick={() => setView('DASHBOARD')} className="bg-[#1E293B] text-white px-4 py-2 rounded-xl font-bold border-b-4 border-black active:border-b-0 active:translate-y-1 transition-all">
                    ← חזרה
                </button>
             </div>

             <Card title={roomCode ? `הצטרפות לחדר ${roomCode}` : "יצירת חדר חדש"} className="w-full max-w-md flex flex-col gap-6">
                  <div className="flex flex-col items-center gap-4">
                     <div className="w-32 h-32 bg-slate-700 rounded-full border-4 border-black flex items-center justify-center text-6xl shadow-neo relative">
                        {avatar}
                        <div className="absolute bottom-0 left-0 bg-white rounded-full p-2 border-2 border-black cursor-pointer shadow-sm hover:scale-110 transition-transform">
                            ✏️
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-5 gap-2 w-full">
                        {AVATARS.slice(0, 10).map(a => (
                            <button 
                              key={a}
                              onClick={() => setAvatar(a)}
                              className={`
                                  text-2xl p-2 rounded-lg hover:bg-white/10 transition-colors
                                  ${avatar === a ? "bg-qb-blue/30 border-2 border-qb-blue" : ""}
                              `}
                            >
                                {a}
                            </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-4">
                     <Input 
                        label="כינוי"
                        placeholder="הכנס את שמך..." 
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={12}
                        autoFocus
                     />
                     
                     <Input 
                        label="קוד חדר (אופציונלי)"
                        placeholder="השאר ריק ליצירת חדר" 
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        maxLength={4}
                        className="text-center tracking-widest uppercase font-mono"
                     />
                  </div>

                  <Button 
                    variant="accent" 
                    size="lg" 
                    fullWidth 
                    onClick={handleAction} 
                    disabled={isSubmitting}
                  >
                     {isSubmitting ? 'מתחבר לשרת...' : (roomCode ? 'הצטרף למשחק! 🚀' : 'צור חדר חדש! 🎲')}
                  </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;

// --- Sub-components (Unchanged but included to maintain file integrity) ---

const StatsCard = ({ bg, border, icon, value, label }: any) => (
  <div className={`${bg} rounded-2xl p-4 border-b-[6px] ${border} flex flex-col items-center justify-center text-center gap-1 shadow-lg hover:brightness-110 transition-all cursor-default`}>
     <div className="mb-1">{icon}</div>
     <div className="text-3xl font-black text-white leading-none">{value}</div>
     <div className="text-white/80 font-bold text-sm uppercase tracking-wide">{label}</div>
  </div>
);

const ChallengeRow = ({ color, icon, title, reward, progress, total }: any) => (
    <div className="bg-[#0F172A] p-3 rounded-xl border border-slate-700 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-200 truncate">{title}</div>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden relative" dir="ltr">
                 {/* Progress bar in LTR so it fills from left to right */}
                <div className={`h-full ${color.replace('text', 'bg')} opacity-80`} style={{ width: `${(progress/total)*100}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                <span>{progress}/{total}</span>
            </div>
        </div>
        <div className="text-left">
             <div className={`font-black ${color} text-sm`}>{reward}</div>
             <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1">
                 <span className="text-xs">🪙</span>
             </div>
        </div>
    </div>
);

const NavItem = ({ icon, label, active }: any) => (
    <button className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${active ? 'text-cyan-400 bg-slate-800/50 border border-slate-700' : 'text-gray-500 hover:text-gray-300'}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
);

// Icons
const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);
const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
const ShopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
);
const GameIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
    </svg>
);