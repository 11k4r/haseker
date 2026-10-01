import type { Poll } from '../types/poll';

/** A poll as delivered to the public feed. Same shape as the DB row. */
export type FeedPoll = Poll;

export interface AgeBucket {
  label: string;
  a: number;
  b: number;
  total?: number;
}

export interface TrendPoint {
  label: string;
  a: number;
  b: number;
}

export interface GenderSlice {
  a: number;
  b: number;
  total: number;
}

export interface RegionRow {
  region: string;
  a: number;
  b: number;
  total: number;
}

export interface CityRow {
  city: string;
  a: number;
  b: number;
  total: number;
}

export interface PollStats {
  topCityA: string;
  topCityB: string;
  ageDistribution: AgeBucket[];
  trendHistory: TrendPoint[];
  genderStats: Record<string, GenderSlice>;
  regionBreakdown: RegionRow[];
  cityBreakdown: CityRow[];
}

/** Shape returned by the get_poll_stats RPC (everything optional/nullable). */
export interface PollStatsRpc {
  topCityA?: string | null;
  topCityB?: string | null;
  ageDistribution?: AgeBucket[] | null;
  trendHistory?: TrendPoint[] | null;
  genderStats?: Record<string, GenderSlice> | null;
  regionBreakdown?: RegionRow[] | null;
  cityBreakdown?: CityRow[] | null;
}

export type VotedPolls = Record<string, string | null>;
