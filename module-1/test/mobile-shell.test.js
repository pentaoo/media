import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMobileShellState, reduceMobileShell as reduce, mobileSnapHeights, mobileSnapAfterDrag } from '../src/mobile-shell-state.js';
import { searchArticles } from '../src/article-search-data.js';

test('the first real material introduces only the compact preview, while video fallback stays quiet', () => {
  let state = initialMobileShellState();
  state = reduce(state, { type: 'context', id: null });
  assert.equal(state.mode, null);
  state = reduce(state, { type: 'context', id: 'first' });
  assert.equal(state.mode, 'context');
  assert.equal(state.snap, 'preview');
  state = reduce(state, { type: 'context', id: 'second' });
  assert.equal(state.snap, 'preview');
  assert.equal(state.unread, false);
});

test('dismissal lasts through forward and reverse chapter changes and a remount', () => {
  let state = reduce(initialMobileShellState(), { type: 'context', id: 'first' });
  state = reduce(state, { type: 'hide' });
  for (const id of ['second', null, 'first']) {
    state = reduce(state, { type: 'context', id });
    assert.equal(state.mode, null);
    assert.equal(state.snap, 'hidden');
    assert.equal(state.dismissed, true);
  }
  state = reduce(initialMobileShellState(state), { type: 'context', id: 'first' });
  assert.equal(state.snap, 'hidden');
  assert.equal(state.unread, true);
  state = reduce(state, { type: 'open' });
  assert.equal(state.snap, 'expanded');
  assert.equal(state.unread, false);
});

test('search and navigation preserve the sheet size and return to the latest context', () => {
  let state = reduce(initialMobileShellState(), { type: 'context', id: 'first' });
  state = reduce(state, { type: 'snap', snap: 'expanded' });
  state = reduce(state, { type: 'overlay', mode: 'search' });
  state = reduce(state, { type: 'context', id: 'second' });
  assert.equal(state.mode, 'search');
  state = reduce(state, { type: 'overlay', mode: 'menu' });
  state = reduce(state, { type: 'back' });
  assert.equal(state.id, 'second');
  assert.equal(state.mode, 'context');
  assert.equal(state.snap, 'expanded');
  assert.equal(state.unread, false);
});

test('first context waits behind search without opening a second layer', () => {
  let state = reduce(initialMobileShellState(), { type: 'overlay', mode: 'search' });
  state = reduce(state, { type: 'context', id: 'first' });
  assert.equal(state.mode, 'search');
  assert.equal(state.snap, 'preview');
  assert.equal(reduce(state, { type: 'back' }).mode, 'context');
});

test('drag stops stay ordered on low screens and flicks move one stop without leaving the screen', () => {
  for (const height of [240, 510, 844]) {
    const sizes = Object.values(mobileSnapHeights(height));
    assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b));
    assert.equal(sizes.length, 3);
    assert.equal(sizes[1], Math.min(88, height * .25));
    assert(sizes.at(-1) <= height);
  }
  assert.equal(mobileSnapAfterDrag({ snap: 'preview', height: 340, viewportHeight: 844, velocity: -.8 }), 'expanded');
  assert.equal(mobileSnapAfterDrag({ snap: 'expanded', height: 340, viewportHeight: 844, velocity: .8 }), 'preview');
  assert.equal(mobileSnapAfterDrag({ snap: 'preview', height: 4, viewportHeight: 844 }), 'hidden');
});

test('the former intermediate height settles to preview or expanded and is never a stop', () => {
  for (const viewportHeight of [360, 510, 844]) {
    const snap = mobileSnapAfterDrag({ snap: 'expanded', height: viewportHeight * .4, viewportHeight });
    assert(['preview', 'expanded'].includes(snap));
  }
  let state = reduce(initialMobileShellState(), { type: 'context', id: 'first' });
  state = reduce(state, { type: 'snap', snap: 'expanded' });
  state = reduce(state, { type: 'snap', snap: 'preview' });
  assert.equal(state.snap, 'preview');
  assert.equal(reduce(state, { type: 'hide' }).snap, 'hidden');
});

test('site search matches article titles and artists, normalizes whitespace and returns an empty result', () => {
  assert.equal(searchArticles().length, 9);
  assert.equal(new Set(searchArticles().map(item => item.image)).size, 9, 'Every preview has its own photo');
  assert.equal(searchArticles('  MADK1D  ')[0].id, 'madk1d');
  assert.equal(searchArticles('свой звук')[0].id, 'new-scene');
  assert.deepEqual(searchArticles('несуществующий запрос'), []);
});
