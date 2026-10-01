import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitPercent,
  isPollOpen,
  shouldPromptLogin,
  localDateInputValue,
  normalizeCityName,
  safeParseVotes,
  getOrCreateDeviceId,
  mergeVotes,
  ANON_VOTE_LIMIT,
} from './logic';

test('splitPercent always sums to exactly 100 (was 101 with Math.round)', () => {
  for (let a = 0; a <= 200; a++) {
    for (let b = 0; b <= 200; b++) {
      const { percentA, percentB } = splitPercent(a, b);
      assert.equal(percentA + percentB, 100, `${a}:${b}`);
      assert.ok(Number.isInteger(percentA) && percentA >= 0 && percentB >= 0, `${a}:${b} range`);
      if (a + b > 0) assert.ok(Math.abs(percentA - (a / (a + b)) * 100) < 1, `${a}:${b} precision`);
    }
  }
});

test('splitPercent edge cases', () => {
  assert.deepEqual(splitPercent(0, 0), { percentA: 50, percentB: 50 });
  assert.deepEqual(splitPercent(5, 0), { percentA: 100, percentB: 0 });
  assert.deepEqual(splitPercent(0, 5), { percentA: 0, percentB: 100 });
  assert.deepEqual(splitPercent(1, 7), { percentA: 13, percentB: 87 }); // regression: was 13 + 88
  assert.equal(splitPercent(-5, 5).percentB, 100);
  assert.equal(splitPercent(NaN, 4).percentB, 100);
});

test('isPollOpen', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  assert.ok(isPollOpen({ status: 'active', expires_at: null }, now));
  assert.ok(isPollOpen({ status: 'active', expires_at: '2026-09-28T12:00:01Z' }, now));
  assert.ok(!isPollOpen({ status: 'active', expires_at: '2026-09-28T12:00:00Z' }, now));
  assert.ok(!isPollOpen({ status: 'active', expires_at: '2026-09-28T11:00:00Z' }, now));
  assert.ok(!isPollOpen({ status: 'closed', expires_at: null }, now));
});

test('login gate keeps prompting after the limit (was ===, so only fired once)', () => {
  assert.ok(!shouldPromptLogin(false, ANON_VOTE_LIMIT - 1));
  assert.ok(shouldPromptLogin(false, ANON_VOTE_LIMIT));
  assert.ok(shouldPromptLogin(false, ANON_VOTE_LIMIT + 1));
  assert.ok(shouldPromptLogin(false, 50));
  assert.ok(!shouldPromptLogin(true, 50));
});

test('localDateInputValue uses local time, not UTC', () => {
  assert.equal(localDateInputValue(new Date(2026, 8, 29, 1, 30)), '2026-09-29');
  assert.equal(localDateInputValue(new Date(2026, 0, 5)), '2026-01-05');
});

test('normalizeCityName mirrors the SQL function', () => {
  assert.equal(normalizeCityName('  תל אביב - יפו '), 'תל אביב-יפו');
  assert.equal(normalizeCityName('תל אביב־יפו'), 'תל אביב-יפו');
  assert.equal(normalizeCityName('באר   שבע'), 'באר שבע');
});

test('safeParseVotes never throws and rejects non-objects', () => {
  assert.deepEqual(safeParseVotes(null), {});
  assert.deepEqual(safeParseVotes('{bad'), {});
  assert.deepEqual(safeParseVotes('[1,2]'), {});
  assert.deepEqual(safeParseVotes('"str"'), {});
  assert.deepEqual(safeParseVotes('{"a":"A"}'), { a: 'A' });
});

test('getOrCreateDeviceId persists and survives blocked storage', () => {
  const store: Record<string, string> = {};
  const fake = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
  const first = getOrCreateDeviceId(fake);
  assert.equal(getOrCreateDeviceId(fake), first);
  assert.equal(store.device_id, first);

  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(typeof getOrCreateDeviceId(blocked), 'string');
  assert.equal(typeof getOrCreateDeviceId(null), 'string');
});

test('mergeVotes: database is authoritative over the local cache', () => {
  assert.equal(mergeVotes({ p1: 'A' }, { p1: 'B' }).p1, 'B');
  assert.deepEqual(mergeVotes({ p1: 'A' }, { p2: 'B' }), { p1: 'A', p2: 'B' });
});
