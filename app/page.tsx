"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { Poll } from '@/lib/types/poll';
import type { AgeBucket, CityRow, PollStats, PollStatsRpc, RegionRow, TrendPoint, VotedPolls } from '@/lib/poll/types';
import {
  getOrCreateDeviceId,
  isPollOpen,
  localDateInputValue,
  mergeVotes,
  safeParseVotes,
  shouldPromptLogin,
  splitPercent,
} from '@/lib/poll/logic';
// Trend Graph Component
const TrendGraph = ({ trend }: { trend: TrendPoint[] }) => {
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

// Two-color donut via stroke-dasharray on a circle — no chart library needed.
const GenderPie = ({ label, pctA, total }: { label: string; pctA: number; total: number }) => {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const aLength = (pctA / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f472b6" strokeWidth="12" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#22d3ee" strokeWidth="12" strokeDasharray={`${aLength} ${circumference - aLength}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-black">
          {total > 0 ? `${pctA}%` : '-'}
        </div>
      </div>
      <span className="text-xs font-bold text-gray-300">{label}</span>
      <span className="text-[10px] text-gray-500">{total} הצבעות</span>
    </div>
  );
};

// A single labeled row with a two-color split bar — used for region/city/age
// breakdowns in the expanded stats view.
const SplitBar = ({ label, pctA, pctB, total }: { label: string; pctA: number; pctB: number; total: number }) => (
  <div className="mb-2.5">
    <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
      <span className="text-gray-200">{label}</span>
      <span>{total} הצבעות</span>
    </div>
    <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-black/40">
      <div className="bg-cyan-400 h-full" style={{ width: `${pctA}%` }} />
      <div className="bg-pink-400 h-full" style={{ width: `${pctB}%` }} />
    </div>
  </div>
);

const DEFAULT_STATS: PollStats = {
  topCityA: "מחשב...",
  topCityB: "מחשב...",
  ageDistribution: [{ label: '0-18', a: 50, b: 50, total: 0 }, { label: '19-25', a: 50, b: 50, total: 0 }, { label: '26-35', a: 50, b: 50, total: 0 }, { label: '36+', a: 50, b: 50, total: 0 }],
  trendHistory: [{ label: 'היום', a: 50, b: 50 }],
  genderStats: {},
  regionBreakdown: [],
  cityBreakdown: [],
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
  const [user, setUser] = useState<User | null>(null);
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
  const [profGender, setProfGender] = useState('');

  const [polls, setPolls] = useState<Poll[]>([]);
  const [votedPolls, setVotedPolls] = useState<VotedPolls>({});
  const [pollStats, setPollStats] = useState<Record<string, PollStats>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'feed' | 'filters' | 'create' | 'mypolls'>('feed');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[] | null>(null); // null = all tags, no filtering
  const [voteStatusFilter, setVoteStatusFilter] = useState<'unvoted' | 'voted' | 'all'>('unvoted');
  const [tagSearch, setTagSearch] = useState('');

  const [myPolls, setMyPolls] = useState<Poll[]>([]);
  const [loadingMyPolls, setLoadingMyPolls] = useState(false);
  
  const [newPollType, setNewPollType] = useState<'blitz' | 'duel'>('blitz');
  const [now, setNow] = useState(() => Date.now()); // ticks so expired polls drop out of the feed
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newPollOptA, setNewPollOptA] = useState('');
  const [newPollOptB, setNewPollOptB] = useState('');
  const [newPollDuration, setNewPollDuration] = useState('60'); 
  const [isCreating, setIsCreating] = useState(false);

  const [loading, setLoading] = useState(true);
  const [currentPollId, setCurrentPollId] = useState<string | null>(null);
  const [liveVotesState, setLiveVotes] = useState<{ pollId: string; votes_a: number; votes_b: number } | null>(null);
  const [pollHistory, setPollHistory] = useState<string[]>([]); // up to 100 previously-viewed poll ids, for "back"
  const [pollSearchText, setPollSearchText] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  // --- MOVED DERIVED STATE TO TOP ---
  const allTags = Array.from(new Set(polls.flatMap(p => p.tags ?? [])));
  const tagsAreFiltered = selectedTags !== null && selectedTags.length < allTags.length;

  const filteredPolls = polls.filter(p => {
    if (!isPollOpen(p, now) && !(p.id in votedPolls)) return false;
    const typeMatch = activeFilter === 'all' || p.poll_type === activeFilter;
    const tagMatch = !tagsAreFiltered || (p.tags?.some(t => selectedTags!.includes(t)) ?? false);
    const voteMatch = voteStatusFilter === 'all' || (voteStatusFilter === 'voted' ? p.id in votedPolls : !(p.id in votedPolls));
    const q = pollSearchText.trim().toLowerCase();
    const searchMatch = !q ||
      (p.title || '').toLowerCase().includes(q) ||
      (p.option_a || '').toLowerCase().includes(q) ||
      (p.option_b || '').toLowerCase().includes(q);
    return typeMatch && tagMatch && voteMatch && searchMatch;
  });
  // Resolved by pinned id from the full poll list (so its votes_a/votes_b
  // stay live-updating), NOT by index into filteredPolls — filteredPolls
  // reactively drops a poll the instant it's voted on (default filter is
  // "unvoted"), which used to yank the results screen onto a different poll
  // mid-vote. currentPollId only changes via explicit navigation.
  const currentPoll = polls.find(p => p.id === currentPollId) ?? null;

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

  // liveVotes is the fresh, per-poll live-subscribed truth; the cached
  // list value is only a fallback for the brief window before it loads.
  // Only trust liveVotes if it belongs to the poll on screen (a slow response
  // for the previous poll must never bleed into the current one).
  const liveVotes = liveVotesState && liveVotesState.pollId === currentPollId ? liveVotesState : null;
  const displayVotesA = liveVotes?.votes_a ?? currentPoll?.votes_a ?? 0;
  const displayVotesB = liveVotes?.votes_b ?? currentPoll?.votes_b ?? 0;
  const totalVotes = displayVotesA + displayVotesB;
  const { percentA, percentB } = splitPercent(displayVotesA, displayVotesB);
  
  const statsData: PollStats | null = currentPoll ? (pollStats[currentPoll.id] || DEFAULT_STATS) : null;
  // ----------------------------------

  // Tick once a minute so a poll that expires while the page is open drops out
  // of the feed (previously expiry was only checked once, at initial load).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const clearAutoAdvance = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchUserData = useCallback(async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (data) {
      setUserRole(data.role);
      setProfNickname(data.nickname || '');
      setProfCity(data.city || '');
      setCitySearch(data.city || '');
      setProfBirthDate(data.date_of_birth || '');
      setProfGender(data.gender || '');
      setIsProfileIncomplete(!data.city || !data.date_of_birth || !data.gender);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchGovCities = async () => {
      try {
        const response = await fetch('https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=1500');
        const data = await response.json();
        if (!cancelled && data?.result?.records) {
          const names = (data.result.records as Record<string, unknown>[])
            .map(r => String(r['שם_ישוב'] ?? '').trim())
            .filter(name => name && name !== 'לא רשום')
            .sort();
          if (names.length > 0) setAllCities(names);
        }
      } catch {
        if (!cancelled) setAllCities(["ירושלים", "תל אביב - יפו", "חיפה", "באר שבע", "ראשון לציון", "פתח תקווה", "אשדוד", "נתניה"]);
      }
    };
    fetchGovCities();

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (cancelled) return;
      setUser(session?.user || null);
      if (session?.user) fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user || null);
      if (session?.user) fetchUserData(session.user.id);
      else { setUserRole('user'); setIsProfileIncomplete(false); }
    });

    const deviceId = getOrCreateDeviceId(localStorage);

    async function fetchData() {
      const nowIso = new Date().toISOString();
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (pollError) {
        setFetchError('לא הצלחנו לטעון את הסקרים. בדוק את החיבור ונסה שוב.');
        setLoading(false);
        return;
      }
      setFetchError(null);

      // Votes are not publicly SELECTable (privacy) — use the narrow
      // get_my_votes RPC, which only ever returns your own.
      const { data: voteData } = await supabase.rpc('get_my_votes', { p_device_id: deviceId });
      if (cancelled) return;

      const localVotes = safeParseVotes(localStorage.getItem('voted_polls_dict'));
      let mergedVotes: VotedPolls = localVotes;
      if (voteData) {
        const dbVotes: VotedPolls = {};
        (voteData as { poll_id: string; choice: string }[]).forEach(v => { dbVotes[v.poll_id] = v.choice; });
        mergedVotes = mergeVotes(localVotes, dbVotes);
        localStorage.setItem('voted_polls_dict', JSON.stringify(mergedVotes));
      }
      setVotedPolls(mergedVotes);

      if (pollData) {
        // The query already asks the server for open polls, but clock skew or
        // a cached response can still hand back one that just expired, so
        // re-check locally before any of them can be chosen as the current poll.
        const shuffled = shuffleArray((pollData as Poll[]).filter(p => isPollOpen(p)));
        setPolls(shuffled);
        const firstUnvoted = shuffled.find(p => !(p.id in mergedVotes));
        const sharedPollId = new URLSearchParams(window.location.search).get('poll');
        const sharedPoll = sharedPollId ? shuffled.find(p => p.id === sharedPollId) : null;
        setCurrentPollId((sharedPoll ?? firstUnvoted ?? shuffled[0])?.id ?? null);
      }

      setLoading(false);
    }
    fetchData();

    return () => {
      cancelled = true;
      clearAutoAdvance();
      subscription.unsubscribe();
    };
  }, [clearAutoAdvance, fetchUserData]);

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profCity || !profBirthDate || !profGender) return;
    const { error } = await supabase.from('users').update({
      nickname: profNickname || null,
      city: profCity,
      date_of_birth: profBirthDate,
      gender: profGender || null,
    }).eq('id', user.id);
    if (!error) setIsProfileIncomplete(false);
    else alert('שגיאה בשמירת הפרופיל. נסה שוב.');
  };

  // Structural changes only (a poll appearing/disappearing) — NOT vote
  // counts. Patching votes_a/votes_b for the whole cached list from two
  // places at once (optimistic math in handleVote + a blanket realtime
  // UPDATE handler here) is exactly what caused counts to disagree between
  // sessions. Vote counts are handled below instead, scoped to only the
  // one poll actually on screen.
  useEffect(() => {
    const channel = supabase
      .channel('public-polls-structure')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls' }, (payload) => {
        const inserted = payload.new as Poll;
        if (isPollOpen(inserted)) {
          setPolls(prev => (prev.some(p => p.id === inserted.id) ? prev : [...prev, inserted]));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'polls' }, (payload) => {
        // Only structural changes matter here (a poll being closed/expired by
        // an admin). Vote counts are deliberately NOT patched into the list —
        // see the per-poll subscription below.
        const updated = payload.new as Poll;
        if (!isPollOpen(updated)) {
          setPolls(prev => prev.filter(p => p.id !== updated.id));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'polls' }, (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        setPolls(prev => prev.filter(p => p.id !== deletedId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // The single source of truth for the poll currently on screen: fetched
  // fresh the moment it becomes current, then kept live via a subscription
  // scoped to that one row (id=eq.<currentPollId>) — not the whole list.
  // This is what handleVote and the percentage math above actually read.
  // (State declared up top with the rest — see liveVotes there.)
  useEffect(() => {
    if (!currentPollId) return;
    let cancelled = false;

    supabase.from('polls').select('votes_a, votes_b').eq('id', currentPollId).single()
      .then(({ data }) => {
        if (!cancelled && data) setLiveVotes({ pollId: currentPollId, votes_a: data.votes_a ?? 0, votes_b: data.votes_b ?? 0 });
      });

    const channel = supabase
      .channel(`poll-votes-${currentPollId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'polls', filter: `id=eq.${currentPollId}` }, (payload) => {
        const updated = payload.new as Pick<Poll, 'votes_a' | 'votes_b'>;
        setLiveVotes({ pollId: currentPollId, votes_a: updated.votes_a ?? 0, votes_b: updated.votes_b ?? 0 });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentPollId]);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (activeTab !== 'mypolls' || !userId) return;
    let cancelled = false;
    supabase.from('polls').select('*').eq('creator_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setMyPolls(data as Poll[]);
        setLoadingMyPolls(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, userId]);

  // If the currently-shown poll no longer matches the active filters (type,
  // tags, vote status, or search text), jump to the first poll that does.
  // Keyed ONLY on the filter controls (not votedPolls/polls) so voting doesn't
  // retrigger this and fight with the vote-results pinning in goToRelative/
  // handleVote. Done during render (React's "adjust state when inputs change"
  // pattern) so there is never a frame showing a poll that fails the filter.
  const filterSignature = JSON.stringify([activeFilter, selectedTags, voteStatusFilter, pollSearchText]);
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    if (currentPollId && !filteredPolls.some(p => p.id === currentPollId)) {
      setCurrentPollId(filteredPolls[0]?.id ?? null);
      setShowStats(false);
    }
  }

  const currentPollIdForStats = currentPoll?.id ?? null;
  const isShowingStatsForCurrent = currentPoll ? showStats || currentPoll.id in votedPolls : false;
  const alreadyHaveStats = currentPollIdForStats ? Boolean(pollStats[currentPollIdForStats]) : false;

  // Pure fetch+map: returns the stats (or null). Callers decide when to store them.
  const fetchStats = useCallback(async (pollId: string): Promise<PollStats | null> => {
    // Aggregated server-side (get_poll_stats RPC) instead of pulling every
    // voter's row into the browser — faster, and no per-voter data leaves the DB.
    const { data, error } = await supabase.rpc('get_poll_stats', { p_poll_id: pollId });
    if (error || !data) return null;
    const d = data as PollStatsRpc;
    return {
      topCityA: d.topCityA || 'טרם נקבע',
      topCityB: d.topCityB || 'טרם נקבע',
      ageDistribution: (d.ageDistribution?.length ? d.ageDistribution : DEFAULT_STATS.ageDistribution) as AgeBucket[],
      trendHistory: (d.trendHistory?.length ? d.trendHistory : DEFAULT_STATS.trendHistory) as TrendPoint[],
      genderStats: d.genderStats || {},
      regionBreakdown: (d.regionBreakdown?.length ? d.regionBreakdown : []) as RegionRow[],
      cityBreakdown: (d.cityBreakdown?.length ? d.cityBreakdown : []) as CityRow[],
    };
  }, []);

  const loadStats = useCallback(async (pollId: string) => {
    const stats = await fetchStats(pollId);
    if (stats) setPollStats(prev => ({ ...prev, [pollId]: stats }));
  }, [fetchStats]);

  // First view of a poll's results: fetch once. setState only happens inside
  // the async callback, guarded so it can't fire after the poll changes/unmounts.
  useEffect(() => {
    if (!currentPollIdForStats || !isShowingStatsForCurrent || alreadyHaveStats) return;
    let cancelled = false;
    fetchStats(currentPollIdForStats).then(stats => {
      if (!cancelled && stats) setPollStats(prev => ({ ...prev, [currentPollIdForStats]: stats }));
    });
    return () => { cancelled = true; };
  }, [currentPollIdForStats, isShowingStatsForCurrent, alreadyHaveStats, fetchStats]);

  const handleVote = async (choice: 'A' | 'B') => {
    if (isProfileIncomplete || !currentPoll) return;
    if (showStats || currentPoll.id in votedPolls) return;
    if (!isPollOpen(currentPoll)) {
      alert('הסקר הזה כבר הסתיים');
      setPolls(prev => prev.filter(p => p.id !== currentPoll.id));
      return;
    }

    const votedPollId = currentPoll.id;
    const previousVotedPolls = votedPolls;
    const deviceId = getOrCreateDeviceId(localStorage);

    setShowStats(true);

    const updatedVotes = { ...votedPolls, [votedPollId]: choice };
    setVotedPolls(updatedVotes);
    localStorage.setItem('voted_polls_dict', JSON.stringify(updatedVotes));

    // Instant feedback on the small, scoped liveVotes state — not the
    // whole cached polls list. The per-poll subscription above will
    // shortly deliver the real server-confirmed count for this same poll
    // and simply overwrite this with the truth.
    const previousLiveVotes = liveVotesState;
    setLiveVotes({
      pollId: votedPollId,
      votes_a: displayVotesA + (choice === 'A' ? 1 : 0),
      votes_b: displayVotesB + (choice === 'B' ? 1 : 0),
    });

    // The above is optimistic — shown immediately for a responsive feel —
    // but the insert is now actually awaited and checked. Previously this
    // was fire-and-forget with no error handling at all: if the insert
    // failed for any reason (flaky connection, RLS, etc.), the UI had
    // already shown a successful vote, "voted" was already written to
    // localStorage, and nothing ever corrected it — surviving even a
    // refresh, while the real vote count silently stayed unchanged.
    const { error } = await supabase
      .from('votes')
      .insert([{ poll_id: votedPollId, choice, device_id: deviceId, user_id: user?.id ?? null }]);

    if (error) {
      clearAutoAdvance();
      setVotedPolls(previousVotedPolls);
      localStorage.setItem('voted_polls_dict', JSON.stringify(previousVotedPolls));
      setLiveVotes(previousLiveVotes);
      setShowStats(false);
      alert('אופס, ההצבעה לא נקלטה. בדוק את החיבור ונסה שוב.');
      return;
    }

    // Our own vote is now in the DB: refresh (or first-load) this poll's stats
    // so the breakdown includes it instead of serving a stale cached copy.
    loadStats(votedPollId);

    timerRef.current = setTimeout(() => {
      if (shouldPromptLogin(Boolean(user), Object.keys(updatedVotes).length)) setShowAuthModal(true);
      else { setShowStats(false); goToRelative(1); }
    }, 1500);
  };

  const submitNewPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setShowAuthModal(true);

    const title = newPollTitle.trim();
    const optA = newPollOptA.trim();
    const optB = newPollOptB.trim();
    if (!title || !optA || !optB) {
      alert('יש למלא שאלה ושתי אפשרויות');
      return;
    }
    if (optA.toLowerCase() === optB.toLowerCase()) {
      alert('שתי האפשרויות חייבות להיות שונות');
      return;
    }

    setIsCreating(true);

    // Duration is clamped to what the DB policy allows (blitz <= 2h, duel 24h).
    const minutes = Math.min(120, Math.max(1, parseInt(newPollDuration, 10) || 60));
    const expiresAt = new Date();
    if (newPollType === 'blitz') expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
    else expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: created, error } = await supabase.from('polls').insert([{
      creator_id: user.id,
      title,
      option_a: optA,
      image_a_url: null,
      option_b: optB,
      image_b_url: null,
      poll_type: newPollType,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    }]).select().single();

    setIsCreating(false);
    if (error || !created) {
      alert('שגיאה ביצירת הסקר');
      return;
    }

    // Keep all in-memory state (votes, history) instead of window.location.reload().
    const poll = created as Poll;
    setPolls(prev => (prev.some(p => p.id === poll.id) ? prev : [poll, ...prev]));
    setNewPollTitle('');
    setNewPollOptA('');
    setNewPollOptB('');
    setNewPollDuration('60');
    setCurrentPollId(poll.id);
    setShowStats(false);
    setActiveTab('feed');
    alert('הסקר נוצר בהצלחה!');
  };

  const sharePoll = (poll: Poll) => {
    const url = `${window.location.origin}/?poll=${poll.id}`;
    const question = poll.title ? poll.title : `${poll.option_a} או ${poll.option_b}`;
    const text = `${question}? 🔥 בואו להצביע בהסקר!\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Moves relative to the CURRENT poll's position within filteredPolls at
  // the moment this is called, then pins the result by id — a subsequent
  // vote (which changes filteredPolls under the "unvoted" default filter)
  // can't yank this back to a different poll afterward. Forward moves are
  // pushed onto pollHistory (capped at 100) so goPrev can retrace the
  // actual viewing history rather than just stepping backward through the
  // live, constantly-shifting filtered list.
  const goToRelative = (offset: number) => {
    if (filteredPolls.length === 0) {
      // Nothing to advance to under current filters. Still record the
      // outgoing poll in history (for "back") before clearing — this is
      // what correctly triggers the "no polls" empty state once the
      // just-voted poll's results window closes, instead of leaving that
      // poll pinned on screen forever.
      if (offset > 0 && currentPollId) {
        setPollHistory(prev => {
          const next = [...prev, currentPollId!];
          return next.length > 100 ? next.slice(next.length - 100) : next;
        });
      }
      setCurrentPollId(null);
      return;
    }
    const idx = filteredPolls.findIndex(p => p.id === currentPollId);
    const baseIdx = idx === -1 ? 0 : idx;
    const nextIdx = ((baseIdx + offset) % filteredPolls.length + filteredPolls.length) % filteredPolls.length;
    const nextId = filteredPolls[nextIdx].id;
    if (offset > 0 && currentPollId && currentPollId !== nextId) {
      setPollHistory(prev => {
        const next = [...prev, currentPollId!];
        return next.length > 100 ? next.slice(next.length - 100) : next;
      });
    }
    setCurrentPollId(nextId);
  };
  const goNext = () => { clearAutoAdvance(); setShowStats(false); goToRelative(1); };
  const goPrev = () => {
    clearAutoAdvance();
    setShowStats(false);
    if (pollHistory.length === 0) return; // nothing viewed before this yet
    const prevId = pollHistory[pollHistory.length - 1];
    setPollHistory(prev => prev.slice(0, -1));
    setCurrentPollId(prevId);
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isProfileIncomplete || touchStartX.current === null || activeTab !== 'feed') return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) goNext();
      else goPrev();
    }
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
                  <button onClick={() => { setLoadingMyPolls(true); setActiveTab('mypolls'); setShowProfileMenu(false); }} className="w-full text-right px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg">הסקרים שלי 📊</button>
                  <button onClick={() => supabase.auth.signOut()} className="w-full text-right px-3 py-2 text-sm text-rose-400 hover:bg-white/5 rounded-lg">התנתק</button>
                </div>
              )}
            </>
          ) : (
            <a href="/login" className="bg-white/10 px-4 py-2 rounded-full border border-white/10 font-bold text-sm">התחבר</a>
          )}
        </div>
      </div>

      {activeTab === 'feed' && currentPoll && (
        <div className="w-full max-w-md flex flex-col gap-4 justify-center animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-wrap items-center gap-2 px-1 mb-1">
            <span className={`bg-gradient-to-r ${currentPoll.poll_type === 'blitz' ? 'from-yellow-400 to-orange-500 text-black' : currentPoll.poll_type === 'duel' ? 'from-red-500 to-rose-700 text-white' : 'from-indigo-500 to-purple-600 text-white'} px-4 py-1.5 text-xs font-black rounded-full`}>
              {currentPoll.poll_type === 'blitz' ? '⚡ סקר בזק' : currentPoll.poll_type === 'duel' ? '⚔️ דו-קרב' : '📊 רגיל'}
            </span>
            {currentPoll.tags?.map(tag => (
              <span key={tag} className="bg-white/10 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
            <button
              onClick={() => sharePoll(currentPoll)}
              className="ms-auto bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all active:scale-95"
              aria-label="שתף בוואטסאפ"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              שתף
            </button>

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
              <div className="flex items-center justify-center gap-10 mb-4">
                <GenderPie label="גברים" pctA={statsData.genderStats?.male?.a ?? 50} total={statsData.genderStats?.male?.total ?? 0} />
                <GenderPie label="נשים" pctA={statsData.genderStats?.female?.a ?? 50} total={statsData.genderStats?.female?.total ?? 0} />
              </div>

              <button
                onClick={() => setStatsExpanded(e => !e)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white py-2 transition-colors"
              >
                {statsExpanded ? 'הסתר פירוט מלא' : 'הצג פירוט מלא'}
                <svg className={`w-4 h-4 transition-transform ${statsExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {statsExpanded && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 p-4 rounded-2xl border border-cyan-500/20"><span className="text-xs text-cyan-400 block mb-1">מעוז ה{currentPoll.option_a}</span><span className="font-black text-lg">{statsData.topCityA}</span></div>
                    <div className="bg-black/30 p-4 rounded-2xl border border-pink-500/20"><span className="text-xs text-pink-400 block mb-1">מעוז ה{currentPoll.option_b}</span><span className="font-black text-lg">{statsData.topCityB}</span></div>
                  </div>

                  {statsData.regionBreakdown.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black text-gray-400 mb-2">לפי אזור</h4>
                      {statsData.regionBreakdown.map((r: RegionRow) => (
                        <SplitBar key={r.region} label={r.region} pctA={r.a} pctB={r.b} total={r.total} />
                      ))}
                    </div>
                  )}

                  {statsData.cityBreakdown.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black text-gray-400 mb-2">לפי עיר</h4>
                      {statsData.cityBreakdown.map((c: CityRow) => (
                        <SplitBar key={c.city} label={c.city} pctA={c.a} pctB={c.b} total={c.total} />
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-black text-gray-400 mb-2">לפי גיל</h4>
                    {statsData.ageDistribution.map((a: AgeBucket) => (
                      <SplitBar key={a.label} label={a.label} pctA={a.a} pctB={a.b} total={a.total ?? 0} />
                    ))}
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-gray-400 mb-2">מגמה לאורך זמן</h4>
                    <TrendGraph trend={statsData.trendHistory} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'feed' && !currentPoll && (
        fetchError ? (
          <div role="alert" className="flex-1 flex flex-col items-center justify-center gap-3 font-bold text-rose-400 text-center px-6">
            <span>{fetchError}</span>
            <button onClick={() => window.location.reload()} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm">נסה שוב</button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center font-bold text-gray-400">אין סקרים בקטגוריה זו</div>
        )
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

          <input
            type="text"
            placeholder="חיפוש לפי כותרת או תשובה..."
            value={pollSearchText}
            onChange={e => setPollSearchText(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-6 text-sm focus:border-cyan-400 outline-none"
          />

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

      {activeTab === 'mypolls' && (
        <div className="w-full max-w-md flex flex-col gap-4 animate-in slide-in-from-bottom-8">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-2xl font-black">הסקרים שלי</h2>
            <button onClick={() => setActiveTab('create')} className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-bold text-sm px-4 py-2 rounded-xl active:scale-95 transition-all shrink-0">+ סקר חדש</button>
          </div>

          {loadingMyPolls ? (
            <div className="text-center text-gray-400 font-bold py-8">טוען...</div>
          ) : myPolls.length === 0 ? (
            <div className="text-center text-gray-400 font-bold py-8">עדיין לא יצרת סקרים</div>
          ) : (
            <div className="flex flex-col gap-3">
              {myPolls.map(poll => {
                const total = (poll.votes_a ?? 0) + (poll.votes_b ?? 0);
                const { percentA: pctA, percentB: pctB } = splitPercent(poll.votes_a ?? 0, poll.votes_b ?? 0);
                const isExpired = poll.expires_at ? new Date(poll.expires_at).getTime() < now : false;
                return (
                  <div key={poll.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-black px-3 py-1 rounded-full ${poll.poll_type === 'blitz' ? 'bg-yellow-500/20 text-yellow-400' : poll.poll_type === 'duel' ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        {poll.poll_type === 'blitz' ? '⚡ בזק' : poll.poll_type === 'duel' ? '⚔️ דו-קרב' : poll.poll_type === 'daily' ? '📅 יומי' : '📊 רגיל'}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        {isExpired ? 'הסתיים · ' : ''}{new Date(poll.created_at).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                    {poll.title && <h3 className="font-bold mb-2 truncate">{poll.title}</h3>}
                    <div className="flex gap-2 text-sm mb-2">
                      <div className="flex-1 min-w-0 bg-cyan-900/20 rounded-lg p-2 text-center">
                        <div className="font-bold truncate">{poll.option_a}</div>
                        <div className="text-cyan-300 font-black">{pctA}%</div>
                      </div>
                      <div className="flex-1 min-w-0 bg-pink-900/20 rounded-lg p-2 text-center">
                        <div className="font-bold truncate">{poll.option_b}</div>
                        <div className="text-pink-300 font-black">{pctB}%</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 font-bold text-center">סה״כ {total} הצבעות</div>
                  </div>
                );
              })}
            </div>
          )}
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

      {user && isProfileIncomplete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-[2rem] p-6">
            <h3 className="text-xl font-black mb-1 text-center">השלמת פרופיל</h3>
            <p className="text-gray-400 text-sm font-bold text-center mb-6">כדי להצביע ולראות תוצאות, נא להשלים כמה פרטים</p>
            <form onSubmit={submitProfile} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="כינוי (לא חובה)"
                value={profNickname}
                onChange={e => setProfNickname(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl p-3 focus:border-cyan-400 outline-none"
              />
              <div className="relative">
                <input
                  type="text"
                  placeholder="עיר מגורים"
                  value={citySearch}
                  onChange={e => { const v = e.target.value; setCitySearch(v); setShowCityDropdown(true); setProfCity(allCities.includes(v.trim()) ? v.trim() : ''); }}
                  onFocus={() => setShowCityDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 focus:border-cyan-400 outline-none"
                />
                {showCityDropdown && citySearch && (
                  <div className="absolute w-full mt-1 max-h-48 overflow-y-auto bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50">
                    {allCities.filter(c => c.includes(citySearch)).slice(0, 50).map(city => (
                      <div key={city} onMouseDown={() => { setProfCity(city); setCitySearch(city); setShowCityDropdown(false); }} className="p-3 hover:bg-white/10 cursor-pointer text-sm font-bold">
                        {city}
                      </div>
                    ))}
                    {allCities.filter(c => c.includes(citySearch)).length === 0 && (
                      <div className="p-3 text-gray-500 text-sm text-center">לא נמצאו ערים</div>
                    )}
                  </div>
                )}
              </div>
              <input
                type="date"
                value={profBirthDate}
                onChange={e => setProfBirthDate(e.target.value)}
                required
                max={localDateInputValue()}
                className="bg-black/50 border border-white/10 rounded-xl p-3 focus:border-cyan-400 outline-none"
              />
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">מגדר</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setProfGender('male')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${profGender === 'male' ? 'bg-cyan-500 text-black' : 'bg-black/50 text-gray-400 hover:text-white'}`}>זכר</button>
                  <button type="button" onClick={() => setProfGender('female')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${profGender === 'female' ? 'bg-pink-500 text-white' : 'bg-black/50 text-gray-400 hover:text-white'}`}>נקבה</button>
                </div>
              </div>
              <button
                type="submit"
                disabled={!profCity || !profBirthDate || !profGender}
                className="mt-2 bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-black py-3 rounded-xl active:scale-95 disabled:opacity-50 transition-all"
              >
                שמור והמשך
              </button>
            </form>
          </div>
        </div>
      )}

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