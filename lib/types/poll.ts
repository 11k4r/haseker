export const POLL_TYPES = ['standard', 'daily', 'blitz', 'duel'] as const;
export type PollType = (typeof POLL_TYPES)[number];

export function isPollType(value: unknown): value is PollType {
  return typeof value === 'string' && (POLL_TYPES as readonly string[]).includes(value);
}

/** A poll row as stored in the `polls` table. */
export interface Poll {
  id: string;
  poll_type: PollType;
  title: string | null;
  option_a: string;
  image_a_url: string | null;
  option_b: string;
  image_b_url: string | null;
  tags: string[];
  status: string;
  created_at: string;
  expires_at: string | null;
  votes_a: number | null;
  votes_b: number | null;
  creator_id: string | null;
}

/**
 * Shape of the create/edit form. Unlike `Poll`, every field is a plain
 * string so form inputs stay simple controlled components — empty string
 * means "no value" and is normalized to `null` server-side before it ever
 * reaches the database.
 */
export interface PollInput {
  poll_type: PollType;
  title: string;
  option_a: string;
  image_a_url: string;
  option_b: string;
  image_b_url: string;
  tags: string[];
}

export const EMPTY_POLL_INPUT: PollInput = {
  poll_type: 'standard',
  title: '',
  option_a: '',
  image_a_url: '',
  option_b: '',
  image_b_url: '',
  tags: [],
};

export function pollToInput(poll: Poll): PollInput {
  return {
    poll_type: poll.poll_type,
    title: poll.title ?? '',
    option_a: poll.option_a,
    image_a_url: poll.image_a_url ?? '',
    option_b: poll.option_b,
    image_b_url: poll.image_b_url ?? '',
    tags: poll.tags ?? [],
  };
}
