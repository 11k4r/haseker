"use client";
import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
// Trend Graph Component
const TrendGraph = ({ trend }: { trend: any[] }) => {
  const width = 100;
  const height = 40;
  
  // Safe X coordinate calculator to prevent NaN when trend.length is 1
  const getX = (i: number) => trend.length === 1 ? width / 2 : (i / (trend.length - 1)) * width;
  
  const getPoints = (key: 'a' | 'b') => trend.map((d, i) => `${getX(i)},${height - (d[key] / 100) * height}`).join(' ');

  return (
    <div className="w-full mt-3">
      <svg viewBox={`0 -5 ${width} ${height + 15}`} className="w-full h-20 overflow-visible drop-shadow-md">
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" strokeWidth="0.5" />
        <polyline points={getPoints('a')} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={getPoints('b')} fill="none" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {trend.map((d, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={height - (d.a / 100) * height} r="2" fill="#0891b2" stroke="#22d3ee" strokeWidth="1" />
            <circle cx={getX(i)} cy={height - (d.b / 100) * height} r="2" fill="#be185d" stroke="#f472b6" strokeWidth="1" />
          </g>
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400 px-1 font-bold">
        {trend.map((d, idx) => <span key={idx}>{d.label}</span>)}
      </div>
    </div>
  );
};

const DEFAULT_STATS = {
  topCityA: "מחשב...",
  topCityB: "מחשב...",
  ageDistribution: [{ label: '0-18', a: 50, b: 50 }, { label: '19-25', a: 50, b: 50 }, { label: '26-35', a: 50, b: 50 }, { label: '36+', a: 50, b: 50 }],
  trendHistory: [{ label: 'היום', a: 50, b: 50 }],
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Box size never changes — font shrinks to fit instead, based on text length.
function getOptionFontSizeClass(text: string): string {
  const len = text?.length || 0;
  if (len <= 8) return 'text-3xl';
  if (len <= 14) return 'text-2xl';
  if (len <= 22) return 'text-xl';
  if (len <= 32) return 'text-lg';
  return 'text-base';
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [allCities, setAllCities] = useState<string[]>([]);
  
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [profCity, setProfCity] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [profBirthDate, setProfBirthDate] = useState('');
  const [profNickname, setProfNickname] = useState('');
  
  const [polls, setPolls] = useState<any[]>([]);
  const [votedPolls, setVotedPolls] = useState<Record<string, string | null>>({});
  const [pollStats, setPollStats] = useState<Record<string, any>>({});
  
  const [activeTab, setActiveTab] = useState<'feed' | 'filters' | 'create'>('feed');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[] | null>(null); // null = all tags, no filtering
  const [voteStatusFilter, setVoteStatusFilter] = useState<'unvoted' | 'voted' | 'all'>('unvoted');
  const [tagSearch, setTagSearch] = useState('');
  
  const [newPollType, setNewPollType] = useState<'blitz' | 'duel'>('blitz');
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newPollOptA, setNewPollOptA] = useState('');
  const [newPollOptB, setNewPollOptB] = useState('');
  const [newPollDuration, setNewPollDuration] = useState('60'); 
  const [isCreating, setIsCreating] = useState(false);

  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  // --- MOVED DERIVED STATE TO TOP ---
  const allTags = Array.from(new Set(polls.flatMap(p => (p.tags as string[] | undefined) || [])));
  const tagsAreFiltered = selectedTags !== null && selectedTags.length < allTags.length;

  const filteredPolls = polls.filter(p => {
    const typeMatch = activeFilter === 'all' || p.poll_type === activeFilter;
    const tagMatch = !tagsAreFiltered || (p.tags?.some((t: string) => selectedTags!.includes(t)) ?? false);
    const voteMatch = voteStatusFilter === 'all' || (voteStatusFilter === 'voted' ? p.id in votedPolls : !(p.id in votedPolls));
    return typeMatch && tagMatch && voteMatch;
  });
  const safeIndex = filteredPolls.length > 0 ? ((currentIndex % filteredPolls.length) + filteredPolls.length) % filteredPolls.length : 0;
  const currentPoll = filteredPolls[safeIndex];

  const isTagSelected = (tag: string) => selectedTags === null || selectedTags.includes(tag);
  const allTagsSelected = selectedTags === null || selectedTags.length === allTags.length;
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const current = prev === null ? allTags : prev;
      return current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    });
  };
  const toggleAllTags = () => {
    setSelectedTags(prev => {
      const current = prev === null ? allTags : prev;
      return current.length === allTags.length ? [] : allTags;
    });
  };
  
  const displayStats = currentPoll && (showStats || currentPoll.id in votedPolls);
  const userChoice = currentPoll ? votedPolls[currentPoll.id] : null;

  let displayVotesA = currentPoll?.votes_a || 0; 
  let displayVotesB = currentPoll?.votes_b || 0;
  if (displayVotesA === 0 && displayVotesB === 0 && userChoice) {
    if (userChoice === 'A') displayVotesA = 1; 
    if (userChoice === 'B') displayVotesB = 1;
  }
  const totalVotes = displayVotesA + displayVotesB;
  const percentA = totalVotes > 0 ? Math.round((displayVotesA / totalVotes) * 100) : 50;
  const percentB = totalVotes > 0 ? Math.round((displayVotesB / totalVotes) * 100) : 50;
  
  const statsData = currentPoll ? (pollStats[currentPoll.id] || DEFAULT_STATS) : null;
  // ----------------------------------

  useEffect(() => {
    const fetchGovCities = async () => {
      try {
        const response = await fetch('https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=1500');
        const data = await response.json();
        if (data?.result?.records) {
          setAllCities(data.result.records.map((r: any) => (r['שם_ישוב'] || '').trim()).filter((n: string) => n && n !== 'לא רשום').sort());
        }
      } catch (e) {
        setAllCities(["ירושלים", "תל אביב-יפו", "חיפה"]);
      }
    };
    fetchGovCities();

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user || null);
      if (session?.user) fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user || null);
      if (session?.user) fetchUserData(session.user.id);
      else { setUserRole('user'); setIsProfileIncomplete(false); }
    });

    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID?.() || ('device-' + Date.now());
      localStorage.setItem('device_id', deviceId);
    }

    async function fetchData() {
      const { data: pollData } = await supabase
        .from('polls')
        .select('*')
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false }); 
      
      if (pollData) setPolls(shuffleArray(pollData));

      // Votes are no longer publicly SELECTable directly (privacy) — use the
      // narrow get_my_votes RPC instead, which only ever returns your own.
      const { data: voteData } = await supabase.rpc('get_my_votes', { p_device_id: deviceId });
      if (voteData) {
        const dbVotes: Record<string, string> = {};
        voteData.forEach((v: { poll_id: string; choice: string }) => { dbVotes[v.poll_id] = v.choice; });
        const localVotes = JSON.parse(localStorage.getItem('voted_polls_dict') || '{}');
        const mergedVotes = { ...localVotes, ...dbVotes };
        setVotedPolls(mergedVotes);
        localStorage.setItem('voted_polls_dict', JSON.stringify(mergedVotes));
      }
      setLoading(false);
    }
    fetchData();
    return () => { clearAutoAdvance(); subscription.unsubscribe(); };
  }, []);

  const fetchUserData = async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (data) {
      setUserRole(data.role);
      if (!data.city || !data.date_of_birth) setIsProfileIncomplete(true);
      else setIsProfileIncomplete(false);
    }
  };

  useEffect(() => {
    if (!currentPoll) return;
    const isShowingStats = showStats || currentPoll.id in votedPolls;

    if (isShowingStats && !pollStats[currentPoll.id]) {
      // Aggregated server-side (get_poll_stats RPC) instead of pulling every
      // voter's row (choice/city/date_of_birth) into the browser to compute
      // client-side — faster, and no per-voter data ever leaves the DB.
      const fetchRealStats = async () => {
        const { data, error } = await supabase.rpc('get_poll_stats', { p_poll_id: currentPoll.id });
        if (error || !data) return;

        setPollStats(prev => ({
          ...prev,
          [currentPoll.id]: {
            topCityA: data.topCityA || 'טרם נקבע',
            topCityB: data.topCityB || 'טרם נקבע',
            ageDistribution: data.ageDistribution?.length ? data.ageDistribution : DEFAULT_STATS.ageDistribution,
            trendHistory: data.trendHistory?.length ? data.trendHistory : DEFAULT_STATS.trendHistory,
          }
        }));
      };
      fetchRealStats();
    }
  }, [currentPoll, showStats, votedPolls]); 

  const handleVote = async (choice: 'A' | 'B') => {
    if (isProfileIncomplete || !currentPoll) return;
    if (showStats || currentPoll.id in votedPolls) return; 
    
    setShowStats(true);
    let deviceId = localStorage.getItem('device_id') || crypto.randomUUID?.() || ('device-' + Date.now());
    
    supabase.from('votes').insert([{ poll_id: currentPoll.id, choice, device_id: deviceId, user_id: user?.id ?? null }]).then();

    const updatedVotes = { ...votedPolls, [currentPoll.id]: choice };
    setVotedPolls(updatedVotes);
    localStorage.setItem('voted_polls_dict', JSON.stringify(updatedVotes));

    setPolls(prev => prev.map(p => p.id === currentPoll.id ? { ...p, votes_a: choice === 'A' ? (p.votes_a || 0) + 1 : (p.votes_a || 0), votes_b: choice === 'B' ? (p.votes_b || 0) + 1 : (p.votes_b || 0) } : p));

    timerRef.current = setTimeout(() => {
      if (!user && Object.keys(updatedVotes).length === 3) setShowAuthModal(true);
      else { setShowStats(false); setCurrentIndex((prev) => prev + 1); }
    }, 1500);
  };

  const submitNewPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setShowAuthModal(true);
    setIsCreating(true);

    const expiresAt = new Date();
    if (newPollType === 'blitz') expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(newPollDuration));
    else expiresAt.setHours(expiresAt.getHours() + 24); 

    const { error } = await supabase.from('polls').insert([{
      creator_id: user.id,
      title: newPollTitle,
      option_a: newPollOptA,
      image_a_url: null,
      option_b: newPollOptB,
      image_b_url: null,
      poll_type: newPollType,
      status: 'active',
      expires_at: expiresAt.toISOString()
    }]);

    setIsCreating(false);
    if (!error) {
      alert("הסקר נוצר בהצלחה!");
      setActiveTab('feed');
      window.location.reload();
    } else alert("שגיאה ביצירת הסקר");
  };

  const clearAutoAdvance = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const goNext = () => { clearAutoAdvance(); setCurrentIndex(currentIndex + 1); setShowStats(false); };
  const goPrev = () => { clearAutoAdvance(); setCurrentIndex(currentIndex - 1); setShowStats(true); };

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isProfileIncomplete || touchStartX.current === null || activeTab !== 'feed') return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 50) deltaX < 0 ? goNext() : goPrev();
    touchStartX.current = null;
  };

  if (loading) return <main className="flex min-h-[100dvh] items-center justify-center bg-[#0a0f1c] text-cyan-400 font-bold text-2xl">טוען...</main>;

  return (
    <main dir="rtl" className="flex min-h-[100dvh] w-full flex-col items-center justify-start bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0a0f1c] to-black p-4 pb-24 pt-20 font-sans relative overflow-x-hidden text-white" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      
	  {/* Desktop Navigation Arrows (Hidden on Mobile) */}
      <button onClick={goPrev} disabled={isProfileIncomplete} className="hidden md:flex absolute right-10 top-1/2 -translate-y-1/2 z-40 w-16 h-16 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full items-center justify-center border border-white/10 transition-all text-gray-400 hover:text-white shadow-lg active:scale-95 disabled:opacity-50" aria-label="Previous Poll">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
      </button>

      <button onClick={goNext} disabled={isProfileIncomplete} className="hidden md:flex absolute left-10 top-1/2 -translate-y-1/2 z-40 w-16 h-16 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full items-center justify-center border border-white/10 transition-all text-gray-400 hover:text-white shadow-lg active:scale-95 disabled:opacity-50" aria-label="Next Poll">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50">
        <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">הסקר</h1>
        <div className="relative">
          {user ? (
            <>
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="bg-white/10 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full" alt="profile" /> : <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs">{user.email?.charAt(0).toUpperCase()}</div>}
                <span className="text-sm font-bold">פרופיל</span>
              </button>
              {showProfileMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-[#111827] border border-white/10 rounded-xl p-1 z-50 shadow-2xl">
                  {userRole === 'admin' && <a href="/admin" className="block px-3 py-2 text-sm text-cyan-400 hover:bg-white/5 rounded-lg text-right">ניהול סקרים ⚙️</a>}
                  <button onClick={() => supabase.auth.signOut()} className="w-full text-right px-3 py-2 text-sm text-rose-400 hover:bg-white/5 rounded-lg">התנתק</button>
                </div>
              )}
            </>
          ) : (
            <a href="/login" className="bg-white/10 px-4 py-2 rounded-full border border-white/10 font-bold text-sm">התחבר</a>
          )}
        </div>
      </div>

      {activeTab === 'feed' && filteredPolls.length > 0 && currentPoll && (
        <div className="w-full max-w-md flex flex-col gap-4 justify-center animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-wrap gap-2 px-1 justify-center mb-1">
            <span className={`bg-gradient-to-r ${currentPoll.poll_type === 'blitz' ? 'from-yellow-400 to-orange-500 text-black' : currentPoll.poll_type === 'duel' ? 'from-red-500 to-rose-700 text-white' : 'from-indigo-500 to-purple-600 text-white'} px-4 py-1.5 text-xs font-black rounded-full`}>
              {currentPoll.poll_type === 'blitz' ? '⚡ סקר בזק' : currentPoll.poll_type === 'duel' ? '⚔️ דו-קרב' : '📊 רגיל'}
            </span>
          </div>
          
          <div className="text-center font-bold text-sm mb-1">
            {totalVotes === 0 && !userChoice ? <span className="text-yellow-400 animate-pulse">היה הראשון להצביע! 🏆</span> : <span className="text-gray-400">סה״כ הצבעות: <span className="text-white">{totalVotes}</span></span>}
          </div>

          <h2 className="text-2xl font-black text-center mb-2">{currentPoll.title}</h2>

          <div className="w-full bg-white/5 rounded-[2rem] flex flex-row h-64 sm:h-80 border border-white/10 p-2 gap-2">
            <button onClick={() => handleVote('A')} className={`flex-1 min-w-0 rounded-2xl font-black flex flex-col items-center justify-center p-4 overflow-hidden transition-all ${displayStats ? `bg-cyan-900/40 cursor-default ${userChoice === 'A' ? 'border-4 border-cyan-400 scale-[1.02]' : 'opacity-40'}` : 'bg-gradient-to-br from-cyan-400 to-blue-600 hover:scale-[1.02] active:scale-95'}`}>
              <span className={`${getOptionFontSizeClass(currentPoll.option_a)} text-center break-words leading-tight line-clamp-3`}>{currentPoll.option_a}</span>
              {displayStats && <span className="text-5xl text-cyan-300 mt-2">{percentA}%</span>}
            </button>
            <button onClick={() => handleVote('B')} className={`flex-1 min-w-0 rounded-2xl font-black flex flex-col items-center justify-center p-4 overflow-hidden transition-all ${displayStats ? `bg-pink-900/40 cursor-default ${userChoice === 'B' ? 'border-4 border-pink-400 scale-[1.02]' : 'opacity-40'}` : 'bg-gradient-to-br from-pink-400 to-rose-600 hover:scale-[1.02] active:scale-95'}`}>
              <span className={`${getOptionFontSizeClass(currentPoll.option_b)} text-center break-words leading-tight line-clamp-3`}>{currentPoll.option_b}</span>
              {displayStats && <span className="text-5xl text-pink-300 mt-2">{percentB}%</span>}
            </button>
          </div>

          {displayStats && statsData && (
            <div className="w-full bg-white/5 rounded-[2rem] p-6 border border-white/10 animate-in fade-in slide-in-from-top-6">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-black/30 p-4 rounded-2xl border border-cyan-500/20"><span className="text-xs text-cyan-400 block mb-1">מעוז ה{currentPoll.option_a}</span><span className="font-black text-lg">{statsData.topCityA}</span></div>
                <div className="bg-black/30 p-4 rounded-2xl border border-pink-500/20"><span className="text-xs text-pink-400 block mb-1">מעוז ה{currentPoll.option_b}</span><span className="font-black text-lg">{statsData.topCityB}</span></div>
              </div>
              <TrendGraph trend={statsData.trendHistory} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'feed' && filteredPolls.length === 0 && (
        <div className="flex-1 flex items-center justify-center font-bold text-gray-400">אין סקרים בקטגוריה זו</div>
      )}

      {activeTab === 'create' && (
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-6 animate-in slide-in-from-bottom-8">
          <h2 className="text-2xl font-black mb-6 text-center">יצירת סקר חדש</h2>
          <form onSubmit={submitNewPoll} className="flex flex-col gap-4">
            
            <div className="flex gap-2 bg-black/50 p-1 rounded-xl">
              <button type="button" onClick={() => setNewPollType('blitz')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${newPollType === 'blitz' ? 'bg-yellow-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>⚡ בזק (קצר)</button>
              <button type="button" onClick={() => setNewPollType('duel')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${newPollType === 'duel' ? 'bg-rose-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>⚔️ דו-קרב (24 שעות)</button>
            </div>

            <input type="text" placeholder="שאלת הסקר (לדוגמה: איפה אוכלים היום?)" value={newPollTitle} onChange={e => setNewPollTitle(e.target.value)} required className="bg-black/50 border border-white/10 rounded-xl p-3 focus:border-cyan-400 outline-none" />
            <div className="flex gap-2">
              <input type="text" placeholder="אופציה א'" value={newPollOptA} onChange={e => setNewPollOptA(e.target.value)} required className="flex-1 min-w-0 bg-cyan-900/30 border border-cyan-500/30 rounded-xl p-3 focus:border-cyan-400 outline-none" />
              <input type="text" placeholder="אופציה ב'" value={newPollOptB} onChange={e => setNewPollOptB(e.target.value)} required className="flex-1 min-w-0 bg-pink-900/30 border border-pink-500/30 rounded-xl p-3 focus:border-pink-400 outline-none" />
            </div>

            {newPollType === 'blitz' && (
              <div>
                <label className="text-xs text-gray-400 font-bold mb-2 block">זמן הסקר: {newPollDuration} דקות</label>
                <input type="range" min="1" max="120" value={newPollDuration} onChange={e => setNewPollDuration(e.target.value)} className="w-full accent-yellow-500" />
              </div>
            )}

            <button type="submit" disabled={isCreating} className="mt-4 bg-white text-black font-black py-3 rounded-xl hover:bg-gray-200 active:scale-95 disabled:opacity-50">
              {isCreating ? 'יוצר סקר...' : 'פרסם עכשיו 🚀'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'filters' && (
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-6 animate-in slide-in-from-bottom-8">
          <h2 className="text-2xl font-black mb-6 text-center">סינון סקרים</h2>
          <div className="flex flex-col gap-3">
            <button onClick={() => { setActiveFilter('all'); setActiveTab('feed'); }} className={`p-4 rounded-xl font-bold border text-right transition-all ${activeFilter === 'all' ? 'bg-white/20 border-white text-white' : 'border-white/10 text-gray-400'}`}>🌍 כל הסקרים</button>
            <button onClick={() => { setActiveFilter('blitz'); setActiveTab('feed'); }} className={`p-4 rounded-xl font-bold border text-right transition-all ${activeFilter === 'blitz' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'border-white/10 text-gray-400'}`}>⚡ סקרי בזק</button>
            <button onClick={() => { setActiveFilter('duel'); setActiveTab('feed'); }} className={`p-4 rounded-xl font-bold border text-right transition-all ${activeFilter === 'duel' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'border-white/10 text-gray-400'}`}>⚔️ דו-קרבות</button>
            <button onClick={() => { setActiveFilter('daily'); setActiveTab('feed'); }} className={`p-4 rounded-xl font-bold border text-right transition-all ${activeFilter === 'daily' ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-white/10 text-gray-400'}`}>📅 סקרים יומיים</button>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-black text-gray-400 mb-3">סטטוס הצבעה</h3>
            <div className="flex gap-2 bg-black/50 p-1 rounded-xl">
              <button onClick={() => setVoteStatusFilter('unvoted')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${voteStatusFilter === 'unvoted' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>לא הצבעתי</button>
              <button onClick={() => setVoteStatusFilter('voted')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${voteStatusFilter === 'voted' ? 'bg-pink-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>כבר הצבעתי</button>
              <button onClick={() => setVoteStatusFilter('all')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${voteStatusFilter === 'all' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>הכל</button>
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-sm font-black text-gray-400 mb-3">תגיות</h3>
              <input
                type="text"
                placeholder="חפש תגית..."
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-sm focus:border-cyan-400 outline-none"
              />
              <button
                type="button"
                onClick={toggleAllTags}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/20 hover:bg-white/5 transition-all text-right mb-2"
              >
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${allTagsSelected ? 'bg-white border-white' : 'border-white/30'}`}>
                  {allTagsSelected && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </span>
                <span className="font-black text-sm">בחר הכל</span>
              </button>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {allTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase())).map(tag => {
                  const checked = isTagSelected(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-right"
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-cyan-500 border-cyan-500' : 'border-white/30'}`}>
                        {checked && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span className="font-bold text-sm">{tag}</span>
                    </button>
                  );
                })}
                {allTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-2">אין תגיות תואמות</p>
                )}
              </div>
            </div>
          )}

          <button onClick={() => setActiveTab('feed')} className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-black py-3 rounded-xl active:scale-95 transition-all">
            הצג תוצאות
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-[#0a0f1c]/90 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex justify-between items-center z-50 pb-safe">
        <button onClick={() => setActiveTab('filters')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'filters' ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          <span className="text-[10px] font-bold">סינון</span>
        </button>
        
        <button onClick={() => { if (!user) setShowAuthModal(true); else setActiveTab('create'); }} className="bg-gradient-to-tr from-cyan-500 to-blue-600 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] -mt-8 border-4 border-[#0a0f1c] active:scale-95 transition-transform text-white">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        </button>
        
        <button onClick={() => setActiveTab('feed')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'feed' ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span className="text-[10px] font-bold">פיד</span>
        </button>
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowAuthModal(false)}>
          <div className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-[2rem] p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-2">צריך להתחבר קודם</h3>
            <p className="text-gray-400 text-sm font-bold mb-6">כדי להצביע ביותר מ-3 סקרים או ליצור סקר חדש, יש להתחבר</p>
            <a href="/login" className="block w-full bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-black py-3 rounded-xl active:scale-95 transition-all mb-2">התחבר</a>
            <button onClick={() => setShowAuthModal(false)} className="w-full text-gray-400 font-bold py-2 text-sm">לא עכשיו</button>
          </div>
        </div>
      )}
    </main>
  );
}
