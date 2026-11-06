import test from 'node:test';
import assert from 'node:assert/strict';
import { contextAtPosition, selectContextState, contextTransitionDirection } from '../src/article-context-state.js';
import { contextMaterialView } from '../src/article-context-view.js';

const ranges = [{ id: 'artist', start: 100, end: 400 }, { id: 'note', start: 700, end: 900 }];

test('card turns follow article source order, including adjacent mentions and reverse jumps', () => {
  const artist = { id: 'artist', order: 10 };
  const track = { id: 'track', order: 11 };
  const album = { id: 'album', order: 12 };
  const lateChapter = { id: 'note', order: 80 };
  assert.equal(contextTransitionDirection(artist, track), 1);
  assert.equal(contextTransitionDirection(track, album), 1);
  assert.equal(contextTransitionDirection(album, artist), -1);
  assert.equal(contextTransitionDirection(artist, lateChapter), 1);
  assert.equal(contextTransitionDirection(lateChapter, track), -1);
  assert.equal(contextTransitionDirection(lateChapter, { id: 'video', order: 90 }), 1);
});

test('first placement, retained material and unknown sources do not invent a turn direction', () => {
  assert.equal(contextTransitionDirection(null, { id: 'artist', order: 10 }), 0);
  assert.equal(contextTransitionDirection({ id: 'album', order: 12 }, { id: 'album', order: 80 }), 0);
  assert.equal(contextTransitionDirection({ id: 'video' }, { id: 'artist', order: 10 }), 0);
  assert.equal(contextTransitionDirection({ id: 'artist', order: 10 }, { id: 'missing' }), 0);
  assert.equal(contextTransitionDirection({ id: 'first', order: 10 }, { id: 'second', order: 10 }), 0);
});

test('reading line follows explicit ranges, gaps, fast jumps and reverse scrolling', () => {
  let previous = null;
  const positions = [0, 150, 350, 500, 800, 1200, 750, 550, 200, 0];
  assert.deepEqual(positions.map(y => previous = contextAtPosition(ranges, y, previous)), [null, 'artist', 'artist', null, 'note', null, 'note', null, 'artist', null]);
  assert.equal(contextAtPosition(ranges, 850), 'note', 'opening directly in the middle selects the current range');
});

test('a 24 pixel dead band prevents boundary flicker in both directions', () => {
  assert.equal(contextAtPosition(ranges, 410, 'artist'), 'artist');
  assert.equal(contextAtPosition(ranges, 423, 'artist'), 'artist');
  assert.equal(contextAtPosition(ranges, 425, 'artist'), null);
  assert.equal(contextAtPosition(ranges, 90, 'artist'), 'artist');
  assert.equal(contextAtPosition(ranges, 75, 'artist'), null);
  assert.equal(contextAtPosition(ranges, 690), null);
  assert.equal(contextAtPosition(ranges, 710), 'note');
});

test('a layout change remeasures ranges and overlap priority follows editorial order', () => {
  assert.equal(contextAtPosition([{ id: 'first', start: 0, end: 100 }, { id: 'second', start: 50, end: 200 }], 75), 'first');
  assert.equal(contextAtPosition([{ id: 'artist', start: 500, end: 800 }], 200, 'artist'), null);
  assert.equal(contextAtPosition([], 200, 'removed'), null);
});

test('manual context overrides ranges, interaction through chapter changes until closed', () => {
  const state = { automaticId: 'note', interactionId: 'artist', manualId: 'footnote-1' };
  assert.deepEqual(selectContextState(state), { type: 'material', id: 'footnote-1', manual: true });
  assert.deepEqual(selectContextState({ ...state, manualId: 'other-note' }), { type: 'material', id: 'other-note', manual: true });
  assert.deepEqual(selectContextState({ ...state, manualId: null, interactionId: null }), { type: 'material', id: 'note', manual: false });
});

test('interaction holds automatic material until blur or selection ends, then catches up immediately', () => {
  assert.deepEqual(selectContextState({ interactionId: 'artist', automaticId: 'note' }), { type: 'material', id: 'artist', manual: false });
  assert.deepEqual(selectContextState({ automaticId: 'note' }), { type: 'material', id: 'note', manual: false });
  assert.deepEqual(selectContextState(), { type: 'video' });
});

test('entity previews are temporary and cannot replace a manually pinned card', () => {
  const state = { previewId: 'artist-madk1d', automaticId: 'madk1d-live', interactionId: 'sexyswag-artwork' };
  assert.deepEqual(selectContextState(state), { type: 'material', id: 'artist-madk1d', manual: false });
  assert.deepEqual(selectContextState({ ...state, manualId: 'track-tak' }), { type: 'material', id: 'track-tak', manual: true });
  assert.deepEqual(selectContextState({ ...state, previewId: null }), { type: 'material', id: 'sexyswag-artwork', manual: false });
});

test('editorial material supports several paragraphs, source links, image credit and safe text', () => {
  const html = contextMaterialView({ id: 'test', kind: 'card', title: '<Имя>', paragraphs: ['Первый абзац', 'Второй абзац'], image: { src: './photo.jpg', alt: 'Фото', width: 100, height: 100, credit: 'Автор' }, sources: [{ label: 'Источник', href: 'https://example.com/?a=1&b=2' }] });
  assert(html.includes('&lt;Имя&gt;'));
  assert(html.includes('<p>Первый абзац</p><p>Второй абзац</p>'));
  assert(html.includes('<figcaption>Автор</figcaption>'));
  assert(html.includes('href="https://example.com/?a=1&amp;b=2"'));
});
