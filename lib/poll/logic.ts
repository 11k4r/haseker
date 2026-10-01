import type { FeedPoll, VotedPolls } from './types';

/**
 * Split a vote count into two whole-number percentages that ALWAYS sum to 100.
 * Plain Math.round on each side can produce 101% (e.g. 1 vs 7 -> 13% + 88%).
 * Uses the largest-remainder method; ties go to A so results are deterministic.
 */
export function splitPercent(votesA: number, votesB: number): { percentA: number; percentB: number } {
  const a = Math.max(0, votesA || 0);
  const b = Math.max(0, votesB || 0);
  const total = a + b;
  if (total === 0) return { percentA: 50, percentB: 50 };

  const exactA = (a / total) * 100;
  const floorA = Math.floor(exactA);
  const floorB = Math.floor(100 - exactA);
  const leftover = 100 - floorA - floorB; // 0 or 1
  const remA = exactA - floorA;
  const remB = 100 - exactA - floorB;

  let percentA = floorA;
  let percentB = floorB;
  if (leftover > 0) {
    if (remA >= remB) percentA += leftover;
    else percentB += leftover;
  }
  return { percentA, percentB };
}

/** True if the poll can still accept votes right now. */
export function isPollOpen(poll: Pick<FeedPoll, 'status' | 'expires_at'>, now: number = Date.now()): boolean {
  if (poll.status !== 'active') return false;
  if (!poll.expires_at) return true;
  return new Date(poll.expires_at).getTime() > now;
}

/**
 * Anonymous visitors get a limited number of votes before being asked to log
 * in. `>=` (not `===`) so the prompt keeps appearing every time after the
 * limit instead of only once, at exactly the Nth vote.
 */
export const ANON_VOTE_LIMIT = 3;
export function shouldPromptLogin(isLoggedIn: boolean, votedCount: number): boolean {
  return !isLoggedIn && votedCount >= ANON_VOTE_LIMIT;
}

/** Local (not UTC) YYYY-MM-DD, for <input type="date" max=...>. */
export function localDateInputValue(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normalize city names the same way the DB's normalize_city_name() does. */
export function normalizeCityName(c: string): string {
  return c.trim().replace(/\s*[-\u05BE]\s*/g, '-').replace(/\s+/g, ' ');
}

/** Merge the localStorage vote cache with the authoritative DB votes. DB wins. */
export function mergeVotes(local: VotedPolls, db: VotedPolls): VotedPolls {
  return { ...local, ...db };
}

/** Safe JSON.parse of a localStorage value; never throws. */
export function safeParseVotes(raw: string | null): VotedPolls {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as VotedPolls) : {};
  } catch {
    return {};
  }
}

/** Stable device id: read, else create AND persist. Falls back if storage is blocked. */
export function getOrCreateDeviceId(storage: Pick<Storage, 'getItem' | 'setItem'> | null): string {
  const generate = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID?.()) || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const existing = storage?.getItem('device_id');
    if (existing) return existing;
    const created = generate();
    storage?.setItem('device_id', created);
    return created;
  } catch {
    return generate();
  }
}
