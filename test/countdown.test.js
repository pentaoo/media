import test from 'node:test';
import assert from 'node:assert/strict';
import { createCountdown, formatCountdown, THIRTY_DAYS_MS } from '../src/countdown.js';

test('a fresh countdown starts at exactly thirty days', () => {
  const timer = createCountdown({ now: () => 100 });
  assert.equal(timer.read().text, '30:00:00:00');
});

test('the first elapsed second rolls over days, hours and minutes', () => {
  let time = 0;
  const timer = createCountdown({ now: () => time });
  time = 999;
  assert.equal(timer.read().text, '30:00:00:00');
  time = 1000;
  assert.equal(timer.read().text, '29:23:59:59');
});

test('delayed callbacks catch up with elapsed wall time', () => {
  let time = 0;
  const timer = createCountdown({ now: () => time });
  time = (3 * 3600 + 15 * 60 + 4) * 1000;
  assert.equal(timer.read().text, '29:20:44:56');
});

test('a new visit resets the countdown instead of restoring a deadline', () => {
  let time = 0;
  const timer = createCountdown({ now: () => time });
  time = 12 * 86400000;
  timer.reset();
  assert.equal(timer.read().text, '30:00:00:00');
});

test('expiry stops at zero and moving the clock back cannot add extra days', () => {
  let time = 0;
  const timer = createCountdown({ now: () => time });
  time = -10000;
  assert.equal(timer.read().text, '30:00:00:00');
  time = THIRTY_DAYS_MS + 10000;
  assert.deepEqual(timer.read(), { remainingMs: 0, text: '00:00:00:00' });
});

test('formatting preserves minute/hour boundaries and clamps expired values', () => {
  assert.equal(formatCountdown(3600000), '00:01:00:00');
  assert.equal(formatCountdown(60000), '00:00:01:00');
  assert.equal(formatCountdown(-1), '00:00:00:00');
});
