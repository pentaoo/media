import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteReadingLayout, quoteScrollState, quoteScrollStickiness, smoothQuoteTravel } from '../src/quote-scroll-state.js';

const scene = { height: 1000, ...quoteReadingLayout(1000, [0, 200]), exit: 680 };

test('quote background is absent on approach and fully visible at the reading position', () => {
  assert.equal(quoteScrollState(-600, scene).mediaOpacity, 0);
  assert.equal(quoteScrollState(-450, scene).mediaOpacity, 0);
  assert.equal(quoteScrollState(-225, scene).mediaOpacity, .5);
  assert.equal(quoteScrollState(0, scene).mediaOpacity, 1);
});

test('every original lyric line has a short stop, including the middle lines', () => {
  const reading = { height: 1000, ...quoteReadingLayout(1000, [0, 150, 310, 530]), exit: 680 };
  for (const stop of reading.stops) {
    for (const distance of [stop.start, (stop.start + stop.end) / 2, stop.end]) {
      assert.equal(quoteScrollState(distance, reading).travel, stop.offset);
      assert.equal(quoteScrollState(distance, reading).mediaOpacity, 1);
    }
  }
  for (const stop of reading.stops.slice(1, -1)) {
    assert.ok(stop.end - stop.start >= 24 && stop.end - stop.start <= 48);
  }
});

test('arriving at and leaving a lyric stop decelerates smoothly', () => {
  const reading = { height: 720, ...quoteReadingLayout(720, [0, 130, 280, 420]), exit: 500 };
  for (let index = 1; index < reading.stops.length; index++) {
    const previous = reading.stops[index - 1];
    const next = reading.stops[index];
    const depart = quoteScrollState(previous.end + 1, reading).travel - previous.offset;
    const arrive = next.offset - quoteScrollState(next.start - 1, reading).travel;
    assert.ok(depart > 0 && depart < .1);
    assert.ok(arrive > 0 && arrive < .1);
  }
});

test('uneven and wrapped lyric lines progress continuously and reverse without jumps', () => {
  for (const offsets of [[0], [0, 125], [0, 133, 320, 540, 700, 905]]) {
    const reading = { height: 844, ...quoteReadingLayout(844, offsets), exit: 600 };
    const distances = Array.from({ length: Math.ceil(reading.runway) + 2 }, (_, index) => index - 1);
    const forward = distances.map(distance => quoteScrollState(distance, reading).travel);
    const reverse = [...distances].reverse().map(distance => quoteScrollState(distance, reading).travel).reverse();
    assert.deepEqual(reverse, forward);
    assert.equal(forward[0], 0);
    assert.equal(forward.at(-1), offsets.at(-1));
    for (let index = 1; index < forward.length; index++) {
      assert.ok(forward[index] >= forward[index - 1]);
      assert.ok(forward[index] - forward[index - 1] <= 1.5);
    }
  }
});

test('the last phrase reaches the reading position before the background fades', () => {
  assert.equal(quoteScrollState(140, scene).travel, 0);
  assert.equal(quoteScrollState(370, scene).travel, 200);
  assert.equal(quoteScrollState(370, scene).mediaOpacity, 1);
  assert.equal(quoteScrollState(scene.runway, scene).mediaOpacity, 1);
  assert.equal(quoteScrollState(scene.runway + 170, scene).mediaOpacity, .5);
  assert.equal(quoteScrollState(scene.runway + 340, scene).mediaOpacity, 0);
  assert.equal(quoteScrollState(1600, scene).mediaOpacity, 0);
});

test('visual smoothing follows the same timing at different frame rates', () => {
  const follow = step => {
    let position = 0;
    for (let elapsed = 0; elapsed < 120; elapsed += step) position = smoothQuoteTravel(position, 150, step);
    return position;
  };
  assert.ok(Math.abs(follow(10) - follow(20)) < .000001);
});

test('fast scrolling bypasses every reading stop and follows input immediately', () => {
  const reading = { height: 844, ...quoteReadingLayout(844, [0, 130, 300, 460]), exit: 600 };
  const strength = quoteScrollStickiness(2);
  assert.equal(strength, 0);
  assert.equal(quoteScrollStickiness(.2), 1);
  assert.ok(quoteScrollStickiness(.8) > 0 && quoteScrollStickiness(.8) < 1);
  for (const stop of reading.stops) {
    const start = quoteScrollState(stop.start, reading, strength);
    const end = quoteScrollState(stop.end, reading, strength);
    assert.ok(end.travel > start.travel);
    assert.equal(end.mediaOpacity, 1);
    assert.equal(smoothQuoteTravel(start.travel, end.travel, 16, strength), end.travel);
  }
});

test('visual smoothing changes direction immediately, settles, and never overshoots', () => {
  let position = smoothQuoteTravel(0, 150, 16);
  assert.ok(position > 0 && position < 150);
  const reversed = smoothQuoteTravel(position, 0, 16);
  assert.ok(reversed >= 0 && reversed < position);
  for (let frame = 0; frame < 60; frame++) position = smoothQuoteTravel(position, 150, 16);
  assert.equal(position, 150);
});

test('lyrics clear before the following article is fully revealed, including reverse scroll', () => {
  const forward = [-600, -225, 0, 240, 480, 820, 1160].map(distance => quoteScrollState(distance, scene));
  const backward = [1160, 820, 480, 240, 0, -225, -600].map(distance => quoteScrollState(distance, scene)).reverse();
  assert.deepEqual(backward, forward);
  assert.equal(quoteScrollState(820, scene).lyricsOpacity, 0);
  for (const state of forward) {
    assert.ok(state.mediaOpacity >= 0 && state.mediaOpacity <= 1);
    assert.ok(state.lyricsOpacity >= 0 && state.lyricsOpacity <= 1);
  }
});
